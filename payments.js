(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.AKPayments = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  const SCHEMA_VERSION = 1
  const PAYMENT_CATEGORIES = new Set(['deposit', 'partial', 'final'])
  const PAYMENT_METHODS = new Set(['cash', 'transfer', 'card', 'other'])
  const LEGACY_DEPOSIT_STATUSES = new Set([
    'Anticipo recibido',
    'Boceto en proceso',
    'Esperando aprobación del boceto',
    'Boceto aprobado',
    'Pintura en proceso',
    'Obra terminada',
    'Esperando saldo',
  ])
  const LEGACY_FULL_STATUSES = new Set([
    'Pago completo',
    'Lista para entregar',
    'Entregada',
    'Seguimiento al cliente',
  ])

  const emptyLedger = () => ({ schemaVersion: SCHEMA_VERSION, movements: [] })

  const requiredText = (value, field) => {
    const normalized = String(value || '').trim()
    if (!normalized) throw new TypeError(`${field} es obligatorio`)
    return normalized
  }

  const optionalText = (value) => {
    const normalized = String(value || '').trim()
    return normalized || null
  }

  const positiveMinor = (value, field = 'amountMinor') => {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TypeError(`${field} debe ser un entero positivo en centavos`)
    }
    return value
  }

  const nonNegativeMinor = (value, field) => {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError(`${field} debe ser un entero no negativo en centavos`)
    }
    return value
  }

  const validDate = (value, field, allowNull = false) => {
    if (allowNull && (value === null || value === undefined || value === '')) return null
    const normalized = String(value || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new TypeError(`${field} debe usar YYYY-MM-DD`)
    const [year, month, day] = normalized.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new TypeError(`${field} no es una fecha válida`)
    }
    return normalized
  }

  const validTimestamp = (value, field) => {
    const normalized = requiredText(value, field)
    if (!Number.isFinite(Date.parse(normalized))) throw new TypeError(`${field} no es una fecha-hora válida`)
    return normalized
  }

  const validateLedger = (ledger) => {
    if (!ledger || ledger.schemaVersion !== SCHEMA_VERSION || !Array.isArray(ledger.movements)) {
      throw new TypeError('ledger no tiene un esquema compatible')
    }
    return ledger
  }

  const ensureUniqueId = (ledger, id) => {
    if (ledger.movements.some((movement) => movement.id === id)) {
      throw new Error(`Ya existe un movimiento con id ${id}`)
    }
  }

  const createPayment = (input) => {
    const category = requiredText(input?.category, 'category')
    if (!PAYMENT_CATEGORIES.has(category)) throw new TypeError('category no es válida')

    const method = optionalText(input?.method)
    if (method && !PAYMENT_METHODS.has(method)) throw new TypeError('method no es válido')

    return Object.freeze({
      id: requiredText(input?.id, 'id'),
      quoteId: requiredText(input?.quoteId, 'quoteId'),
      type: 'payment',
      category,
      amountMinor: positiveMinor(input?.amountMinor),
      currency: 'MXN',
      occurredOn: validDate(input?.occurredOn, 'occurredOn'),
      method,
      note: optionalText(input?.note),
      createdAt: validTimestamp(input?.createdAt, 'createdAt'),
      source: 'manual',
      inferred: false,
      migrated: false,
      needsReview: false,
      reversesMovementId: null,
      correctionReason: null,
    })
  }

  const appendPayment = (ledger, input) => {
    validateLedger(ledger)
    const movement = createPayment(input)
    ensureUniqueId(ledger, movement.id)
    return { ...ledger, movements: [...ledger.movements, movement] }
  }

  const createReversal = (ledger, input) => {
    validateLedger(ledger)
    const originalId = requiredText(input?.reversesMovementId, 'reversesMovementId')
    const original = ledger.movements.find((movement) => movement.id === originalId)
    if (!original || original.type !== 'payment') throw new Error('El pago original no existe')
    if (ledger.movements.some((movement) => movement.type === 'reversal' && movement.reversesMovementId === originalId)) {
      throw new Error('El pago original ya fue revertido')
    }

    return Object.freeze({
      id: requiredText(input?.id, 'id'),
      quoteId: original.quoteId,
      type: 'reversal',
      category: original.category,
      amountMinor: -positiveMinor(original.amountMinor),
      currency: 'MXN',
      occurredOn: validDate(input?.occurredOn, 'occurredOn'),
      method: null,
      note: optionalText(input?.note),
      createdAt: validTimestamp(input?.createdAt, 'createdAt'),
      source: 'manual',
      inferred: false,
      migrated: false,
      needsReview: false,
      reversesMovementId: originalId,
      correctionReason: requiredText(input?.correctionReason, 'correctionReason'),
    })
  }

  const appendReversal = (ledger, input) => {
    const movement = createReversal(ledger, input)
    ensureUniqueId(ledger, movement.id)
    return { ...ledger, movements: [...ledger.movements, movement] }
  }

  const movementsFor = (ledger, quoteId) => {
    validateLedger(ledger)
    const normalizedQuoteId = requiredText(quoteId, 'quoteId')
    return ledger.movements.filter((movement) => movement.quoteId === normalizedQuoteId)
  }

  const summarize = (ledger, quoteId, amounts) => {
    const priceMinor = nonNegativeMinor(amounts?.priceMinor, 'priceMinor')
    const requiredDepositMinor = nonNegativeMinor(amounts?.requiredDepositMinor, 'requiredDepositMinor')
    if (requiredDepositMinor > priceMinor) throw new TypeError('requiredDepositMinor no puede superar priceMinor')

    const netPaidMinor = movementsFor(ledger, quoteId)
      .reduce((sum, movement) => sum + movement.amountMinor, 0)
    const totalPaidMinor = Math.max(0, netPaidMinor)
    const balanceMinor = Math.max(0, priceMinor - totalPaidMinor)

    return {
      priceMinor,
      requiredDepositMinor,
      totalPaidMinor,
      balanceMinor,
      overpaymentMinor: Math.max(0, totalPaidMinor - priceMinor),
      depositCovered: totalPaidMinor >= requiredDepositMinor,
      paidInFull: totalPaidMinor >= priceMinor,
    }
  }

  const pesosToMinor = (value) => {
    const pesos = Number(value)
    if (!Number.isFinite(pesos) || pesos <= 0) return 0
    return Math.round(pesos * 100)
  }

  const legacyAmount = (quote) => {
    const status = String(quote?.status || '').trim()
    if (status === 'Cancelada') return 0
    if (LEGACY_FULL_STATUSES.has(status)) return pesosToMinor(quote?.price?.suggestedPrice)
    if (LEGACY_DEPOSIT_STATUSES.has(status)) return pesosToMinor(quote?.price?.deposit)
    return 0
  }

  const migrateV1Quotes = (ledger, quotes, options) => {
    validateLedger(ledger)
    if (!Array.isArray(quotes)) throw new TypeError('quotes debe ser un arreglo')
    const migratedAt = validTimestamp(options?.migratedAt, 'migratedAt')
    let movements = [...ledger.movements]

    quotes.forEach((quote) => {
      const quoteId = String(quote?.id || '').trim()
      if (!quoteId || movements.some((movement) => movement.quoteId === quoteId)) return

      const amountMinor = legacyAmount(quote)
      if (!amountMinor) return

      const id = `migration:v1:${quoteId}:inferred-payment`
      if (movements.some((movement) => movement.id === id)) return

      movements.push(Object.freeze({
        id,
        quoteId,
        type: 'payment',
        category: 'legacy',
        amountMinor,
        currency: 'MXN',
        occurredOn: null,
        method: null,
        note: null,
        createdAt: migratedAt,
        source: 'migration',
        inferred: true,
        migrated: true,
        needsReview: true,
        reversesMovementId: null,
        correctionReason: null,
        legacyStatus: String(quote.status || ''),
      }))
    })

    return { ...ledger, movements }
  }

  return {
    SCHEMA_VERSION,
    emptyLedger,
    createPayment,
    appendPayment,
    createReversal,
    appendReversal,
    movementsFor,
    summarize,
    migrateV1Quotes,
  }
})
