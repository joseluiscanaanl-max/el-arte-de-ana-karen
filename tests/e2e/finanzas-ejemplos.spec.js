const { test, expect } = require('@playwright/test')

test('los registros de ejemplo permanecen fuera de todos los totales financieros', async ({ page }) => {
  await page.addInitScript(() => {
    const now = '2026-08-10T12:00:00.000Z'
    localStorage.setItem('ak-settings-v1', JSON.stringify({
      hourlyRate: 75,
      marginPercent: 35,
      depositPercent: 50,
      indirectPercent: 10,
    }))
    localStorage.setItem('ak-clients-v1', JSON.stringify([
      { id: 'client-laura', name: 'Laura Martínez', createdAt: now },
      { id: 'client-real', name: 'Cliente Real', createdAt: now },
    ]))
    localStorage.setItem('ak-quotes-v1', JSON.stringify([
      {
        id: 'quote-example',
        clientId: 'client-laura',
        title: 'Retrato familiar al atardecer',
        status: 'Esperando aprobación de cotización',
        createdAt: now,
        updatedAt: now,
        price: { suggestedPrice: 1000, deposit: 500, balance: 500, profit: 300 },
      },
      {
        id: 'quote-real',
        clientId: 'client-real',
        title: 'Obra real',
        status: 'Borrador',
        createdAt: now,
        updatedAt: now,
        price: { suggestedPrice: 2000, deposit: 1000, balance: 1000, profit: 600 },
      },
    ]))
    localStorage.setItem('ak-promotions-v1', '[]')
    localStorage.setItem('ak-payments-ledger-v1', JSON.stringify({
      schemaVersion: 1,
      movements: [],
      migrations: { v1Quotes: { completed: true, completedAt: now } },
    }))
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.locator('[data-ak-finance-metric="quoted"] strong')).toHaveText('$2,000.00')
  await expect(page.locator('[data-ak-finance-metric="paid"] strong')).toHaveText('$0.00')
  await expect(page.locator('[data-ak-finance-metric="pending"] strong')).toHaveText('$2,000.00')

  await expect(page.locator('[data-ak-finance-client-row="client-real"]')).toBeVisible()
  await expect(page.locator('[data-ak-finance-client-row="client-laura"]')).toBeHidden()
  await expect(page.locator('.ak-finance-note')).toContainText('Los registros de ejemplo no se incluyen en estos totales.')
})
