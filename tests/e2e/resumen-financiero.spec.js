const { test, expect } = require('@playwright/test')

const LEDGER_KEY = 'ak-payments-ledger-v1'
const QUOTE_MAIN = 'quote-finance-main'
const QUOTE_MIGRATED = 'quote-finance-migrated'
const QUOTE_OVERPAID = 'quote-finance-overpaid'

test('el resumen financiero usa exclusivamente pagos, reversos y saldos del ledger', async ({ page }) => {
  test.setTimeout(120_000)

  await page.addInitScript(({ ledgerKey, quoteMain, quoteMigrated, quoteOverpaid }) => {
    if (sessionStorage.getItem('ak-finance-e2e-ready')) return
    localStorage.clear()
    sessionStorage.clear()
    sessionStorage.setItem('ak-finance-e2e-ready', 'true')

    localStorage.setItem('ak-clients-v1', JSON.stringify([
      { id: 'client-a', name: 'Cliente Finanzas A', createdAt: '2026-08-07T10:00:00.000Z' },
      { id: 'client-b', name: 'Cliente Finanzas B', createdAt: '2026-08-07T10:00:00.000Z' },
    ]))
    localStorage.setItem('ak-quotes-v1', JSON.stringify([
      {
        id: quoteMain, clientId: 'client-a', title: 'Pedido principal finanzas', width: 30, height: 40,
        technique: 'Acrílico', status: 'Borrador', createdAt: '2026-08-07T10:00:00.000Z', updatedAt: '2026-08-07T10:00:00.000Z',
        price: { suggestedPrice: 1000, deposit: 500, balance: 500, profit: 300 },
      },
      {
        id: quoteMigrated, clientId: 'client-a', title: 'Pedido migrado finanzas', width: 20, height: 30,
        technique: 'Óleo', status: 'Anticipo recibido', createdAt: '2026-08-07T10:00:00.000Z', updatedAt: '2026-08-07T10:00:00.000Z',
        price: { suggestedPrice: 800, deposit: 400, balance: 400, profit: 250 },
      },
      {
        id: quoteOverpaid, clientId: 'client-b', title: 'Pedido con sobrepago', width: 20, height: 20,
        technique: 'Acrílico', status: 'Borrador', createdAt: '2026-08-07T10:00:00.000Z', updatedAt: '2026-08-07T10:00:00.000Z',
        price: { suggestedPrice: 500, deposit: 250, balance: 250, profit: 150 },
      },
    ]))
    localStorage.setItem(ledgerKey, JSON.stringify({
      schemaVersion: 1,
      movements: [
        {
          id: `migration:v1:${quoteMigrated}:inferred-payment`, quoteId: quoteMigrated, type: 'payment', category: 'legacy',
          amountMinor: 40000, currency: 'MXN', occurredOn: null, method: null, note: null,
          createdAt: '2026-08-07T10:00:00.000Z', source: 'migration', inferred: true, migrated: true,
          needsReview: true, reversesMovementId: null, correctionReason: null, legacyStatus: 'Anticipo recibido',
        },
        {
          id: 'payment-overpaid', quoteId: quoteOverpaid, type: 'payment', category: 'partial',
          amountMinor: 60000, currency: 'MXN', occurredOn: '2026-08-07', method: 'transfer', note: 'Sobrepago E2E',
          createdAt: '2026-08-07T10:00:00.000Z', source: 'manual', inferred: false, migrated: false,
          needsReview: false, reversesMovementId: null, correctionReason: null,
        },
      ],
      migrations: { v1Quotes: { completed: true, completedAt: '2026-08-07T10:00:00.000Z' } },
    }))
  }, {
    ledgerKey: LEDGER_KEY,
    quoteMain: QUOTE_MAIN,
    quoteMigrated: QUOTE_MIGRATED,
    quoteOverpaid: QUOTE_OVERPAID,
  })

  const metric = (name) => page.locator(`[data-ak-finance-metric="${name}"] strong`)
  const orderCard = (title) => page.locator('.order-card').filter({ hasText: title })
  const mainOrder = () => orderCard('Pedido principal finanzas')

  const openHome = async () => {
    await page.getByRole('button', { name: /Inicio/ }).click()
    await expect(page.getByRole('heading', { name: 'Mi taller creativo' })).toBeVisible()
    await expect(metric('quoted')).toBeVisible()
  }

  const openOrders = async () => {
    await page.getByRole('button', { name: /Pedidos/ }).click()
    await expect(page.getByRole('heading', { name: 'Mis encargos' })).toBeVisible()
    await expect(mainOrder()).toBeVisible()
  }

  const expectWorkshop = async ({ quoted = '$2,300.00', covered, paid, pending }) => {
    await expect(metric('quoted')).toHaveText(quoted)
    await expect(metric('covered-deposit')).toHaveText(covered)
    await expect(metric('paid')).toHaveText(paid)
    await expect(metric('pending')).toHaveText(pending)
  }

  const registerMainPayment = async ({ category, amount, note }) => {
    await openOrders()
    const section = mainOrder().locator('.order-payments')
    await section.getByRole('button', { name: 'Registrar pago' }).click()
    const dialog = section.getByRole('dialog', { name: 'Registrar pago' })
    await dialog.getByLabel('Tipo de pago').selectOption(category)
    await dialog.getByLabel('Importe en pesos').fill(amount)
    await dialog.getByLabel('Nota (opcional)').fill(note)
    await dialog.getByRole('button', { name: 'Guardar pago' }).click()
    await expect(dialog).not.toBeVisible()
    await openHome()
  }

  await test.step('pedido sin pagos, movimiento migrado, sobrepago y totales iniciales', async () => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expectWorkshop({ covered: '$650.00', paid: '$1,000.00', pending: '$1,400.00' })
    await expect(page.getByText('Puede existir información migrada de V1 pendiente de revisión.')).toBeVisible()
    await expect(page.getByText('Sobrepago total: $100.00')).toBeVisible()

    await page.locator('.ak-finance-client-button').filter({ hasText: 'Cliente Finanzas A' }).click()
    const mainDetail = page.locator(`[data-ak-finance-quote-id="${QUOTE_MAIN}"]`)
    await expect(mainDetail).toContainText('Pagado$0.00')
    await expect(mainDetail).toContainText('Pendiente$1,000.00')

    const migratedDetail = page.locator(`[data-ak-finance-quote-id="${QUOTE_MIGRATED}"]`)
    await expect(migratedDetail).toContainText('Pagado$400.00')
    await expect(migratedDetail).toContainText('Incluye información migrada de V1 pendiente de revisión.')

    await page.locator('.ak-finance-client-button').filter({ hasText: 'Cliente Finanzas B' }).click()
    const overpaidDetail = page.locator(`[data-ak-finance-quote-id="${QUOTE_OVERPAID}"]`)
    await expect(overpaidDetail).toContainText('Pendiente$0.00')
    await expect(overpaidDetail).toContainText('Sobrepago: $100.00')
  })

  await test.step('cambiar a Anticipo recibido sin pago no altera ninguna cifra', async () => {
    await openOrders()
    const select = mainOrder().locator('select[data-status-id]')
    await select.selectOption({ label: 'Anticipo recibido' })
    const confirmation = mainOrder().locator('.workflow-confirm-button')
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      confirmation.click(),
    ])
    await openHome()
    await expectWorkshop({ covered: '$650.00', paid: '$1,000.00', pending: '$1,400.00' })
  })

  await test.step('primer pago real actualiza pagado, anticipo cubierto y pendiente', async () => {
    await registerMainPayment({ category: 'deposit', amount: '200.00', note: 'Primer pago resumen E2E' })
    await expectWorkshop({ covered: '$850.00', paid: '$1,200.00', pending: '$1,200.00' })
  })

  await test.step('varios pagos se suman y el pago completo deja pendiente solo en otros pedidos', async () => {
    await registerMainPayment({ category: 'partial', amount: '300.00', note: 'Segundo pago resumen E2E' })
    await expectWorkshop({ covered: '$1,150.00', paid: '$1,500.00', pending: '$900.00' })
    await registerMainPayment({ category: 'final', amount: '500.00', note: 'Pago final resumen E2E' })
    await expectWorkshop({ covered: '$1,150.00', paid: '$2,000.00', pending: '$400.00' })
    await page.locator('.ak-finance-client-button').filter({ hasText: 'Cliente Finanzas A' }).click()
    await expect(page.locator(`[data-ak-finance-quote-id="${QUOTE_MAIN}"]`)).toContainText('Pendiente$0.00')
  })

  await test.step('reverso disminuye pagado y aumenta pendiente', async () => {
    await openOrders()
    const section = mainOrder().locator('.order-payments')
    await section.getByText('Historial de movimientos').click()
    const firstPayment = section.locator('.payment-history-item').filter({ hasText: 'Primer pago resumen E2E' })
    await firstPayment.getByRole('button', { name: 'Corregir pago' }).click()
    const dialog = section.getByRole('dialog', { name: 'Corregir pago' })
    await dialog.getByLabel('Motivo de la corrección').fill('Corrección para resumen financiero E2E')
    await dialog.getByLabel(/Confirmo que deseo registrar esta corrección/).check()
    await dialog.getByRole('button', { name: 'Guardar corrección' }).click()
    await openHome()
    await expectWorkshop({ covered: '$1,150.00', paid: '$1,800.00', pending: '$600.00' })
  })

  await test.step('pago sustituto restaura cifras y todo persiste al recargar', async () => {
    await registerMainPayment({ category: 'deposit', amount: '200.00', note: 'Pago sustituto resumen E2E' })
    await expectWorkshop({ covered: '$1,150.00', paid: '$2,000.00', pending: '$400.00' })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expectWorkshop({ covered: '$1,150.00', paid: '$2,000.00', pending: '$400.00' })

    await page.locator('.ak-finance-client-button').filter({ hasText: 'Cliente Finanzas A' }).click()
    const clientARow = page.locator('.ak-finance-client-button').filter({ hasText: 'Cliente Finanzas A' }).locator('xpath=ancestor::tr')
    await expect(clientARow.locator('td').nth(1)).toHaveText('$1,800.00')
    await expect(clientARow.locator('td').nth(2)).toHaveText('$900.00')
    await expect(clientARow.locator('td').nth(3)).toHaveText('$1,400.00')
    await expect(clientARow.locator('td').nth(4)).toHaveText('$400.00')

    const totalRow = page.locator('.ak-finance-total')
    await expect(totalRow.locator('td').nth(1)).toHaveText('$2,300.00')
    await expect(totalRow.locator('td').nth(2)).toHaveText('$1,150.00')
    await expect(totalRow.locator('td').nth(3)).toHaveText('$2,000.00')
    await expect(totalRow.locator('td').nth(4)).toHaveText('$400.00')
  })

  await test.step('ledger corrupto bloquea el resumen sin mostrar ceros falsos ni sobrescribir', async () => {
    const corruptRaw = '{resumen-ledger-dañado'
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: LEDGER_KEY, raw: corruptRaw })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('alert', { name: '' }).filter({ hasText: 'Resumen financiero no disponible' })).toBeVisible()
    await expect(page.locator('[data-ak-finance-metric]')).toHaveCount(0)
    await expect(page.getByText(/El resumen financiero no puede calcularse porque el ledger está dañado/)).toBeVisible()
    await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), LEDGER_KEY)).toBe(corruptRaw)
  })
})
