const { test, expect } = require('@playwright/test')

test.use({ serviceWorkers: 'allow' })

const LEDGER_KEY = 'ak-payments-ledger-v1'
const QUOTE_ID = 'quote-offline-v2'
const QUOTE_TITLE = 'Pedido Offline V2'

const REQUIRED_CACHED_RESOURCES = [
  './index.html',
  './payments.js',
  './payments-storage.js',
  './payments-ui.js',
  './payments-ui.css',
  './home-finance-summary.js',
  './workflow-fix.js',
  './order-integrity.js',
  './joce-photo-analysis.js?v=20',
  './joce-canvas-fit.js?v=24',
  './joce-acrylic-preview.js?v=42',
  './joce-acrylic-share.js?v=26',
  './joce-acrylic-estimates.js?v=27',
  './joce-canvas-catalog.js?v=28',
  './joce-approved-fixed-layout.js?v=31',
]

test('la PWA v25 conserva clientes, pedidos y finanzas completamente offline', async ({ page, context }) => {
  test.setTimeout(120_000)

  await page.addInitScript(async ({ quoteId, quoteTitle, ledgerKey }) => {
    if (sessionStorage.getItem('ak-offline-e2e-seeded')) return
    localStorage.clear()
    sessionStorage.setItem('ak-offline-e2e-seeded', 'true')
    localStorage.setItem('ak-clients-v1', JSON.stringify([{
      id: 'client-offline', name: 'Cliente Offline V2', whatsapp: '528330000000', createdAt: '2026-08-07T10:00:00.000Z',
    }]))
    localStorage.setItem('ak-quotes-v1', JSON.stringify([{
      id: quoteId, clientId: 'client-offline', title: quoteTitle, width: 30, height: 40, technique: 'Acrílico',
      status: 'Borrador', createdAt: '2026-08-07T10:00:00.000Z', updatedAt: '2026-08-07T10:00:00.000Z',
      price: { suggestedPrice: 1000, deposit: 500, balance: 500, profit: 300 },
    }]))
    localStorage.setItem('ak-promotions-v1', '[]')
    localStorage.setItem(ledgerKey, JSON.stringify({
      schemaVersion: 1,
      movements: [],
      migrations: { v1Quotes: { completed: true, completedAt: '2026-08-07T10:00:00.000Z' } },
    }))
    const oldCache = await caches.open('ana-karen-v24')
    await oldCache.put('./recurso-antiguo', new Response('antiguo'))
    const foreignCache = await caches.open('otra-aplicacion-cache')
    await foreignCache.put('./recurso-ajeno', new Response('ajeno'))
  }, { quoteId: QUOTE_ID, quoteTitle: QUOTE_TITLE, ledgerKey: LEDGER_KEY })

  const orderCard = () => page.locator('.order-card').filter({ hasText: QUOTE_TITLE })
  const paymentSection = () => orderCard().locator('.order-payments')

  const openOrders = async () => {
    await page.getByRole('button', { name: /Pedidos/ }).click()
    await expect(page.getByRole('heading', { name: 'Mis encargos' })).toBeVisible()
    await expect(orderCard()).toBeVisible()
  }

  const registerPayment = async (amount, note) => {
    const section = paymentSection()
    await section.getByRole('button', { name: 'Registrar pago' }).click()
    const dialog = section.getByRole('dialog', { name: 'Registrar pago' })
    await dialog.getByLabel('Importe en pesos').fill(amount)
    await dialog.getByLabel('Nota (opcional)').fill(note)
    await dialog.getByRole('button', { name: 'Guardar pago' }).click()
    await expect(dialog).not.toBeVisible()
  }

  await test.step('instalar v25, eliminar solo cachés anteriores propias y precachear módulos críticos', async () => {
    await page.goto('/', { waitUntil: 'load' })
    await page.evaluate(() => navigator.serviceWorker.ready)
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
    await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(expect.arrayContaining(['ana-karen-v25', 'otra-aplicacion-cache']))
    const cacheNames = await page.evaluate(() => caches.keys())
    expect(cacheNames).not.toContain('ana-karen-v24')
    expect(cacheNames).toContain('otra-aplicacion-cache')

    const cached = await page.evaluate(async (resources) => {
      const cache = await caches.open('ana-karen-v25')
      return Object.fromEntries(await Promise.all(resources.map(async (resource) => [
        resource,
        Boolean(await cache.match(new URL(resource, location.href).href)),
      ])))
    }, REQUIRED_CACHED_RESOURCES)
    expect(Object.values(cached).every(Boolean)).toBe(true)
  })

  await test.step('abrir sin conexión y consultar clientes, pedidos, pagos y resumen', async () => {
    await openOrders()
    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Mi taller creativo' })).toBeVisible()
    await openOrders()
    await expect(orderCard()).toBeVisible()
    await expect(paymentSection().getByRole('button', { name: 'Registrar pago' })).toBeVisible()

    await page.getByRole('button', { name: /Clientes/ }).click()
    await expect(page.getByText('Cliente Offline V2', { exact: true })).toBeVisible()
    await openOrders()
  })

  await test.step('registrar y revertir un pago offline actualiza ledger e historial', async () => {
    await registerPayment('200.00', 'Pago offline inicial')
    await expect(paymentSection().locator('[data-payment-paid]')).toHaveText('$200.00')
    await expect(paymentSection().locator('[data-payment-balance]')).toHaveText('$800.00')
    await paymentSection().getByText('Historial de movimientos').click()
    const payment = paymentSection().locator('.payment-history-item').filter({ hasText: 'Pago offline inicial' })
    await payment.getByRole('button', { name: 'Corregir pago' }).click()
    const dialog = paymentSection().getByRole('dialog', { name: 'Corregir pago' })
    await dialog.getByLabel('Motivo de la corrección').fill('Corrección offline')
    await dialog.getByLabel(/Confirmo que deseo registrar esta corrección/).check()
    await dialog.getByRole('button', { name: 'Guardar corrección' }).click()
    await expect(paymentSection().locator('[data-payment-paid]')).toHaveText('$0.00')
    await expect(paymentSection().locator('[data-payment-balance]')).toHaveText('$1,000.00')

    const movements = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).movements, LEDGER_KEY)
    expect(movements).toHaveLength(2)
    expect(movements[1].type).toBe('reversal')
    expect(movements[1].amountMinor).toBe(-movements[0].amountMinor)
  })

  await test.step('workflow y resumen financiero funcionan offline con pago sustituto', async () => {
    const select = orderCard().locator('select[data-status-id]')
    await select.selectOption({ label: 'Anticipo recibido' })
    let alertMessage = ''
    page.once('dialog', async (dialog) => {
      alertMessage = dialog.message()
      await dialog.accept()
    })
    await orderCard().locator('.workflow-confirm-button').click()
    expect(alertMessage).toContain('Primero registra un pago')

    await registerPayment('500.00', 'Pago sustituto offline')
    await select.selectOption({ label: 'Anticipo recibido' })
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      orderCard().locator('.workflow-confirm-button').click(),
    ])
    await expect(orderCard().locator('.status-pill')).toHaveText('Anticipo recibido')

    await page.getByRole('button', { name: /Inicio/ }).click()
    await expect(page.locator('[data-ak-finance-metric="paid"] strong')).toHaveText('$500.00')
    await expect(page.locator('[data-ak-finance-metric="pending"] strong')).toHaveText('$500.00')
  })

  await test.step('recargar todavía offline conserva movimientos, totales e historial', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-ak-finance-metric="paid"] strong')).toHaveText('$500.00')
    await openOrders()
    await expect(paymentSection().locator('[data-payment-paid]')).toHaveText('$500.00')
    await paymentSection().getByText('Historial de movimientos').click()
    await expect(paymentSection().locator('.payment-history-item')).toHaveCount(3)
    const movements = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).movements, LEDGER_KEY)
    expect(movements.map((movement) => movement.type)).toEqual(['payment', 'reversal', 'payment'])
  })
})
