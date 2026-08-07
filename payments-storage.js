(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports ? require('./payments.js') : root.AKPayments
  )
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.AKPaymentStorage = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function (AKPayments) {
  'use strict'

  if (!AKPayments) throw new Error('AKPayments debe cargarse antes de AKPaymentStorage')

  const LEDGER_KEY = 'ak-payments-ledger-v1'
  const QUOTES_KEY = 'ak-quotes-v1'

  const createEmptyLedger = () => ({
    ...AKPayments.emptyLedger(),
    migrations: {},
  })

  const isTimestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))
  const isDateOrNull = (value) => value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))

  const validateMovement = (movement, ids) => {
    if (!movement || typeof movement !== 'object' || Array.isArray(movement)) return false
    if (typeof movement.id !== 'string' || !movement.id.trim() || ids.has(movement.id)) return false
    ids.add(movement.id)
    if (typeof movement.quoteId !== 'string' || !movement.quoteId.trim()) return false
    if (!['payment', 'reversal'].includes(movement.type)) return false
    if (!Number.isSafeInteger(movement.amountMinor) || movement.amountMinor === 0) return false
    if (movement.type === 'payment' && movement.amountMinor < 0) return false
    if (movement.type === 'reversal' && movement.amountMinor > 0) return false
    if (movement.currency !== 'MXN' || !isDateOrNull(movement.occurredOn) || !isTimestamp(movement.createdAt)) return false
    if (typeof movement.inferred !== 'boolean' || typeof movement.migrated !== 'boolean' || typeof movement.needsReview !== 'boolean') return false
    if (movement.type === 'reversal' && (typeof movement.reversesMovementId !== 'string' || !movement.reversesMovementId)) return false
    return true
  }

  const validateLedger = (ledger) => {
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) return false
    if (ledger.schemaVersion !== AKPayments.SCHEMA_VERSION || !Array.isArray(ledger.movements)) return false
    const ids = new Set()
    if (!ledger.movements.every((movement) => validateMovement(movement, ids))) return false
    if (ledger.migrations !== undefined && (!ledger.migrations || typeof ledger.migrations !== 'object' || Array.isArray(ledger.migrations))) return false
    const migration = ledger.migrations?.v1Quotes
    if (migration !== undefined) {
      if (!migration || migration.completed !== true || !isTimestamp(migration.completedAt)) return false
    }
    return true
  }

  const createStore = (storage) => {
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
      throw new TypeError('storage debe implementar getItem y setItem')
    }

    const load = () => {
      const raw = storage.getItem(LEDGER_KEY)
      if (raw === null) {
        return { status: 'empty', ledger: createEmptyLedger(), raw: null, error: null }
      }

      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch (error) {
        return { status: 'corrupt', ledger: createEmptyLedger(), raw, error: error.message }
      }

      if (!validateLedger(parsed)) {
        return {
          status: 'incompatible',
          ledger: createEmptyLedger(),
          raw,
          error: 'El ledger no coincide con el esquema soportado',
        }
      }

      return { status: 'valid', ledger: parsed, raw, error: null }
    }

    const save = (ledger) => {
      if (!validateLedger(ledger)) throw new TypeError('No se puede guardar un ledger inválido')
      const raw = JSON.stringify(ledger)
      storage.setItem(LEDGER_KEY, raw)
      return ledger
    }

    const migrateV1Quotes = (quotes, options) => {
      const loaded = load()
      if (loaded.status === 'corrupt' || loaded.status === 'incompatible') {
        return { ...loaded, migrated: false, preservedInvalidData: true }
      }
      if (loaded.ledger.migrations?.v1Quotes?.completed) {
        return { ...loaded, status: 'valid', migrated: false, preservedInvalidData: false }
      }

      const completedAt = options?.migratedAt
      if (!isTimestamp(completedAt)) throw new TypeError('migratedAt no es una fecha-hora válida')
      const migratedLedger = AKPayments.migrateV1Quotes(loaded.ledger, quotes, { migratedAt: completedAt })
      const ledger = {
        ...migratedLedger,
        migrations: {
          ...(migratedLedger.migrations || {}),
          v1Quotes: { completed: true, completedAt },
        },
      }
      save(ledger)
      return { status: 'valid', ledger, raw: JSON.stringify(ledger), error: null, migrated: true, preservedInvalidData: false }
    }

    return { load, save, migrateV1Quotes }
  }

  const readQuotes = (storage) => {
    const raw = storage.getItem(QUOTES_KEY)
    if (raw === null) return { status: 'empty', quotes: [], raw: null, error: null }
    try {
      const quotes = JSON.parse(raw)
      if (!Array.isArray(quotes)) throw new TypeError('Las cotizaciones no son un arreglo')
      return { status: 'valid', quotes, raw, error: null }
    } catch (error) {
      return { status: 'invalid', quotes: [], raw, error: error.message }
    }
  }

  const bootstrap = (storage, options = {}) => {
    const quotes = readQuotes(storage)
    if (quotes.status === 'invalid') {
      return { status: 'quotes-invalid', ledger: createEmptyLedger(), migrated: false, quotes }
    }
    const migratedAt = options.migratedAt || new Date().toISOString()
    return createStore(storage).migrateV1Quotes(quotes.quotes, { migratedAt })
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    window.AKPaymentStorageState = bootstrap(window.localStorage)
  }

  return {
    LEDGER_KEY,
    QUOTES_KEY,
    createEmptyLedger,
    validateLedger,
    createStore,
    readQuotes,
    bootstrap,
  }
})
