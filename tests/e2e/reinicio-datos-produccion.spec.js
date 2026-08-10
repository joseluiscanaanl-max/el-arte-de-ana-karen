const { test, expect } = require('@playwright/test')

const SETTINGS = {
  hourlyRate: 75,
  marginPercent: 35,
  depositPercent: 50,
  indirectPercent: 10,
}

const OLD_QUOTE = {
  id: 'quote-old-test',
  clientId: 'client-old-test',
  title: 'Cotización de prueba anterior',
  status: 'Anticipo recibido',
  createdAt: '2026-08-10T10:00:00.000Z',
  updatedAt: '2026-08-10T10:00:00.000Z',
  price: { suggestedPrice: 5000, deposit: 2500, balance: 2500, profit: 1500 },
}

test('el reinicio de producción deja las bases operativas en cero y conserva la configuración', async ({ page }) => {
  await page.addInitScript(({ settings, quote }) => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('ak-settings-v1', JSON.stringify(settings))
    localStorage.setItem('ak-clients-v1', JSON.stringify([
      { id: 'client-old-test', name: 'Cliente de prueba', createdAt: '2026-08-10T10:00:00.000Z' },
    ]))
    localStorage.setItem('ak-quotes-v1', JSON.stringify([quote]))
    localStorage.setItem('ak-promotions-v1', JSON.stringify([{ id: 'promo-old-test', title: 'Prueba' }]))
    localStorage.setItem('ak-followups-v1', JSON.stringify({ version: 1, items: [{ id: 'followup-old-test' }] }))
    localStorage.setItem('ak-payments-ledger-v1', JSON.stringify({
      schemaVersion: 1,
      movements: [{
        id: 'payment-old-test',
        quoteId: quote.id,
        type: 'payment',
        amountMinor: 250000,
        currency: 'MXN',
        occurredOn: '2026-08-10',
        createdAt: '2026-08-10T10:05:00.000Z',
        inferred: false,
        migrated: false,
        needsReview: false,
      }],
      migrations: { v1Quotes: { completed: true, completedAt: '2026-08-10T10:00:00.000Z' } },
    }))
    sessionStorage.setItem('ak-joce-reference-v1', 'referencia-temporal')
  }, { settings: SETTINGS, quote: OLD_QUOTE })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-ak-finance-metric="quoted"] strong')).toHaveText('$5,000.00')

  const result = await page.evaluate(() => window.AKProductionDataReset.resetOperationalData(
    localStorage,
    sessionStorage,
    { resetAt: '2026-08-10T23:50:00.000Z' }
  ))
  expect(result.reset).toBe(true)

  const cleared = await page.evaluate(() => ({
    settings: JSON.parse(localStorage.getItem('ak-settings-v1')),
    clients: localStorage.getItem('ak-clients-v1'),
    quotes: localStorage.getItem('ak-quotes-v1'),
    promotions: localStorage.getItem('ak-promotions-v1'),
    followups: localStorage.getItem('ak-followups-v1'),
    ledger: localStorage.getItem('ak-payments-ledger-v1'),
    marker: localStorage.getItem('ak-production-data-reset-v2-0-6'),
    temporaryReference: sessionStorage.getItem('ak-joce-reference-v1'),
  }))

  expect(cleared.settings).toEqual(SETTINGS)
  expect(cleared.clients).toBeNull()
  expect(cleared.quotes).toBeNull()
  expect(cleared.promotions).toBeNull()
  expect(cleared.followups).toBeNull()
  expect(cleared.ledger).toBeNull()
  expect(cleared.marker).not.toBeNull()
  expect(cleared.temporaryReference).toBeNull()

  await page.reload({ waitUntil: 'domcontentloaded' })

  await expect(page.locator('[data-ak-finance-metric="quoted"] strong')).toHaveText('$0.00')
  await expect(page.locator('[data-ak-finance-metric="covered-deposit"] strong')).toHaveText('$0.00')
  await expect(page.locator('[data-ak-finance-metric="paid"] strong')).toHaveText('$0.00')
  await expect(page.locator('[data-ak-finance-metric="pending"] strong')).toHaveText('$0.00')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ak-quotes-v1'))).toBeNull()

  const persisted = await page.evaluate(() => ({
    hourlyRate: JSON.parse(localStorage.getItem('ak-settings-v1')).hourlyRate,
    movements: JSON.parse(localStorage.getItem('ak-payments-ledger-v1')).movements,
  }))
  expect(persisted.hourlyRate).toBe(75)
  expect(persisted.movements).toEqual([])

  const newQuote = { ...OLD_QUOTE, id: 'quote-new-real', title: 'Cotización nueva real', status: 'Borrador' }
  const secondRun = await page.evaluate((quote) => {
    localStorage.setItem('ak-quotes-v1', JSON.stringify([quote]))
    const result = window.AKProductionDataReset.resetOperationalData(
      localStorage,
      sessionStorage,
      { resetAt: '2026-08-11T00:00:00.000Z' }
    )
    return { result, quotes: JSON.parse(localStorage.getItem('ak-quotes-v1')) }
  }, newQuote)

  expect(secondRun.result.reset).toBe(false)
  expect(secondRun.result.reason).toBe('already-reset')
  expect(secondRun.quotes).toHaveLength(1)
  expect(secondRun.quotes[0].id).toBe('quote-new-real')
})