const assert = require('node:assert/strict')
const {
  emptyLedger,
  createPayment,
  appendPayment,
  appendReversal,
  summarize,
  migrateV1Quotes,
} = require('../payments.js')

const NOW = '2026-08-07T12:00:00.000Z'
const DATE = '2026-08-07'

const payment = (overrides = {}) => ({
  id: 'payment-1',
  quoteId: 'quote-1',
  category: 'deposit',
  amountMinor: 200000,
  occurredOn: DATE,
  method: 'transfer',
  note: 'Anticipo confirmado',
  createdAt: NOW,
  ...overrides,
})

const amounts = { priceMinor: 500000, requiredDepositMinor: 250000 }

{
  const created = createPayment(payment())
  assert.deepEqual(created, {
    id: 'payment-1', quoteId: 'quote-1', type: 'payment', category: 'deposit',
    amountMinor: 200000, currency: 'MXN', occurredOn: DATE, method: 'transfer',
    note: 'Anticipo confirmado', createdAt: NOW, source: 'manual', inferred: false,
    migrated: false, needsReview: false, reversesMovementId: null, correctionReason: null,
  })
  assert.ok(Object.isFrozen(created))
}

{
  const original = emptyLedger()
  const withDeposit = appendPayment(original, payment())
  const withPartial = appendPayment(withDeposit, payment({
    id: 'payment-2', category: 'partial', amountMinor: 50000, note: null,
  }))
  const withFinal = appendPayment(withPartial, payment({
    id: 'payment-3', category: 'final', amountMinor: 250000, method: 'cash', note: null,
  }))

  assert.equal(original.movements.length, 0, 'appendPayment no debe mutar el libro original')
  assert.deepEqual(summarize(withDeposit, 'quote-1', amounts), {
    ...amounts, totalPaidMinor: 200000, balanceMinor: 300000, overpaymentMinor: 0,
    depositCovered: false, paidInFull: false,
  })
  assert.deepEqual(summarize(withPartial, 'quote-1', amounts), {
    ...amounts, totalPaidMinor: 250000, balanceMinor: 250000, overpaymentMinor: 0,
    depositCovered: true, paidInFull: false,
  })
  assert.deepEqual(summarize(withFinal, 'quote-1', amounts), {
    ...amounts, totalPaidMinor: 500000, balanceMinor: 0, overpaymentMinor: 0,
    depositCovered: true, paidInFull: true,
  })
}

{
  const withPayment = appendPayment(emptyLedger(), payment({ amountMinor: 250000 }))
  const corrected = appendReversal(withPayment, {
    id: 'reversal-1', reversesMovementId: 'payment-1', occurredOn: DATE,
    correctionReason: 'Importe capturado por error', note: 'Se registrará el importe correcto', createdAt: NOW,
  })

  assert.equal(withPayment.movements.length, 1, 'appendReversal no debe mutar el libro original')
  assert.equal(corrected.movements[1].amountMinor, -250000)
  assert.equal(corrected.movements[1].quoteId, 'quote-1')
  assert.equal(corrected.movements[1].reversesMovementId, 'payment-1')
  assert.equal(summarize(corrected, 'quote-1', amounts).totalPaidMinor, 0)
  assert.throws(() => appendReversal(corrected, {
    id: 'reversal-2', reversesMovementId: 'payment-1', occurredOn: DATE,
    correctionReason: 'Segundo intento', createdAt: NOW,
  }), /ya fue revertido/)
}

{
  assert.throws(() => createPayment(payment({ id: '' })), /id es obligatorio/)
  assert.throws(() => createPayment(payment({ quoteId: '' })), /quoteId es obligatorio/)
  assert.throws(() => createPayment(payment({ amountMinor: 0 })), /entero positivo/)
  assert.throws(() => createPayment(payment({ amountMinor: -100 })), /entero positivo/)
  assert.throws(() => createPayment(payment({ amountMinor: 10.5 })), /entero positivo/)
  assert.throws(() => createPayment(payment({ category: 'legacy' })), /category no es válida/)
  assert.throws(() => createPayment(payment({ method: 'crypto' })), /method no es válido/)
  assert.throws(() => createPayment(payment({ occurredOn: '2026-02-30' })), /fecha válida/)
  assert.throws(() => createPayment(payment({ createdAt: 'ayer' })), /fecha-hora válida/)
  assert.throws(() => appendPayment(appendPayment(emptyLedger(), payment()), payment()), /Ya existe/)
  assert.throws(() => appendReversal(emptyLedger(), {
    id: 'reversal-1', reversesMovementId: 'missing', occurredOn: DATE,
    correctionReason: 'Error', createdAt: NOW,
  }), /no existe/)
  assert.throws(() => appendReversal(appendPayment(emptyLedger(), payment()), {
    id: 'reversal-1', reversesMovementId: 'payment-1', occurredOn: DATE,
    correctionReason: '', createdAt: NOW,
  }), /correctionReason es obligatorio/)
  assert.throws(() => summarize(emptyLedger(), 'quote-1', {
    priceMinor: 100000, requiredDepositMinor: 110000,
  }), /no puede superar/)
}

{
  const quotes = [
    { id: 'draft', status: 'Borrador', price: { suggestedPrice: 5000, deposit: 2500 } },
    { id: 'waiting', status: 'Esperando anticipo', price: { suggestedPrice: 5000, deposit: 2500 } },
    { id: 'deposit', status: 'Anticipo recibido', price: { suggestedPrice: 5000, deposit: 2500 } },
    { id: 'partial-stage', status: 'Esperando saldo', price: { suggestedPrice: 6000, deposit: 3000 } },
    { id: 'paid', status: 'Pago completo', price: { suggestedPrice: 7000, deposit: 3500 } },
    { id: 'delivered', status: 'Entregada', price: { suggestedPrice: 8000, deposit: 4000 } },
    { id: 'cancelled', status: 'Cancelada', price: { suggestedPrice: 9000, deposit: 4500 } },
    { id: 'invalid', status: 'Pago completo', price: { suggestedPrice: 0, deposit: 0 } },
  ]

  const once = migrateV1Quotes(emptyLedger(), quotes, { migratedAt: NOW })
  const twice = migrateV1Quotes(once, quotes, { migratedAt: NOW })

  assert.equal(once.movements.length, 4)
  assert.deepEqual(twice, once, 'la migración repetida no debe duplicar ni cambiar movimientos')
  assert.equal(once.movements.find((item) => item.quoteId === 'deposit').amountMinor, 250000)
  assert.equal(once.movements.find((item) => item.quoteId === 'partial-stage').amountMinor, 300000)
  assert.equal(once.movements.find((item) => item.quoteId === 'paid').amountMinor, 700000)
  assert.equal(once.movements.find((item) => item.quoteId === 'delivered').amountMinor, 800000)
  once.movements.forEach((movement) => {
    assert.equal(movement.occurredOn, null)
    assert.equal(movement.source, 'migration')
    assert.equal(movement.inferred, true)
    assert.equal(movement.migrated, true)
    assert.equal(movement.needsReview, true)
    assert.equal(movement.category, 'legacy')
  })
  assert.equal(once.movements.some((item) => item.quoteId === 'draft'), false)
  assert.equal(once.movements.some((item) => item.quoteId === 'waiting'), false)
  assert.equal(once.movements.some((item) => item.quoteId === 'cancelled'), false)
  assert.equal(once.movements.some((item) => item.quoteId === 'invalid'), false)
}

{
  const existing = appendPayment(emptyLedger(), payment({ quoteId: 'paid' }))
  const migrated = migrateV1Quotes(existing, [
    { id: 'paid', status: 'Pago completo', price: { suggestedPrice: 7000, deposit: 3500 } },
  ], { migratedAt: NOW })
  assert.equal(migrated.movements.length, 1, 'no debe inferir pagos si el pedido ya tiene movimientos')
}

console.log('Payment domain tests passed')
