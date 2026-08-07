const assert = require('node:assert/strict')
const AKPayments = require('../payments.js')
const {
  LEDGER_KEY,
  createEmptyLedger,
  createStore,
  bootstrap,
} = require('../payments-storage.js')

const NOW = '2026-08-07T15:00:00.000Z'

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial))
    this.writes = []
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null
  }

  setItem(key, value) {
    this.values.set(key, String(value))
    this.writes.push({ key, value: String(value) })
  }
}

const manualPayment = () => ({
  id: 'payment-1', quoteId: 'quote-1', category: 'deposit', amountMinor: 250000,
  occurredOn: '2026-08-07', method: 'transfer', note: null, createdAt: NOW,
})

{
  const storage = new MemoryStorage()
  const loaded = createStore(storage).load()
  assert.equal(loaded.status, 'empty')
  assert.deepEqual(loaded.ledger, createEmptyLedger())
  assert.equal(storage.writes.length, 0, 'cargar almacenamiento vacío no debe escribir')
}

{
  const ledger = AKPayments.appendPayment(createEmptyLedger(), manualPayment())
  const storage = new MemoryStorage({ [LEDGER_KEY]: JSON.stringify(ledger) })
  const loaded = createStore(storage).load()
  assert.equal(loaded.status, 'valid')
  assert.deepEqual(loaded.ledger, ledger)
  assert.equal(storage.writes.length, 0)
}

{
  const corruptRaw = '{"schemaVersion":1,"movements":['
  const storage = new MemoryStorage({ [LEDGER_KEY]: corruptRaw })
  const result = createStore(storage).load()
  assert.equal(result.status, 'corrupt')
  assert.equal(result.raw, corruptRaw)
  assert.deepEqual(result.ledger, createEmptyLedger())
  assert.equal(storage.getItem(LEDGER_KEY), corruptRaw, 'el JSON corrupto debe permanecer intacto')
  assert.equal(storage.writes.length, 0)
}

{
  const incompatibleRaw = JSON.stringify({ schemaVersion: 99, movements: [] })
  const storage = new MemoryStorage({ [LEDGER_KEY]: incompatibleRaw })
  const result = createStore(storage).load()
  assert.equal(result.status, 'incompatible')
  assert.equal(result.raw, incompatibleRaw)
  assert.equal(storage.getItem(LEDGER_KEY), incompatibleRaw, 'el esquema incompatible debe permanecer intacto')
  assert.equal(storage.writes.length, 0)
}

{
  const storage = new MemoryStorage()
  const firstStore = createStore(storage)
  const ledger = AKPayments.appendPayment(createEmptyLedger(), manualPayment())
  firstStore.save(ledger)

  const reloaded = createStore(storage).load()
  assert.equal(reloaded.status, 'valid')
  assert.deepEqual(reloaded.ledger, ledger)
  assert.equal(reloaded.ledger.movements[0].amountMinor, 250000)
}

{
  const quotes = [
    { id: 'deposit', status: 'Anticipo recibido', price: { suggestedPrice: 5000, deposit: 2500 } },
    { id: 'paid', status: 'Pago completo', price: { suggestedPrice: 7000, deposit: 3500 } },
    { id: 'waiting', status: 'Esperando anticipo', price: { suggestedPrice: 6000, deposit: 3000 } },
  ]
  const storage = new MemoryStorage({ 'ak-quotes-v1': JSON.stringify(quotes) })
  const first = bootstrap(storage, { migratedAt: NOW })
  const persistedRaw = storage.getItem(LEDGER_KEY)
  const second = bootstrap(storage, { migratedAt: '2026-08-08T15:00:00.000Z' })

  assert.equal(first.migrated, true)
  assert.equal(first.ledger.movements.length, 2)
  assert.equal(first.ledger.migrations.v1Quotes.completed, true)
  assert.equal(first.ledger.migrations.v1Quotes.completedAt, NOW)
  first.ledger.movements.forEach((movement) => {
    assert.equal(movement.occurredOn, null)
    assert.equal(movement.inferred, true)
    assert.equal(movement.migrated, true)
    assert.equal(movement.needsReview, true)
  })
  assert.equal(second.migrated, false)
  assert.equal(second.ledger.movements.length, 2)
  assert.equal(storage.getItem(LEDGER_KEY), persistedRaw, 'repetir bootstrap no debe reescribir el ledger')

  quotes[2].status = 'Anticipo recibido'
  storage.setItem('ak-quotes-v1', JSON.stringify(quotes))
  const afterStatusChange = bootstrap(storage, { migratedAt: '2026-08-09T15:00:00.000Z' })
  assert.equal(afterStatusChange.ledger.movements.some((movement) => movement.quoteId === 'waiting'), false)
}

{
  const corruptRaw = 'datos de pago dañados'
  const storage = new MemoryStorage({
    [LEDGER_KEY]: corruptRaw,
    'ak-quotes-v1': JSON.stringify([
      { id: 'paid', status: 'Pago completo', price: { suggestedPrice: 7000, deposit: 3500 } },
    ]),
  })
  const result = bootstrap(storage, { migratedAt: NOW })
  assert.equal(result.migrated, false)
  assert.equal(result.preservedInvalidData, true)
  assert.equal(storage.getItem(LEDGER_KEY), corruptRaw)
}

{
  const badQuotes = '{sin-json'
  const storage = new MemoryStorage({ 'ak-quotes-v1': badQuotes })
  const result = bootstrap(storage, { migratedAt: NOW })
  assert.equal(result.status, 'quotes-invalid')
  assert.equal(storage.getItem('ak-quotes-v1'), badQuotes)
  assert.equal(storage.getItem(LEDGER_KEY), null)
}

console.log('Payment storage tests passed')
