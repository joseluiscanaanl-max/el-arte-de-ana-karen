const { test, expect } = require('@playwright/test')

const CLIENT_NAME = 'Cliente E2E V2'
const QUOTE_TITLE = 'Retrato E2E V2'
const REMINDER_DATE = '2026-08-20'

const workflow = [
  'Cotización enviada',
  'Esperando aprobación de cotización',
  'Esperando anticipo',
  'Anticipo recibido',
  'Boceto en proceso',
  'Esperando aprobación del boceto',
  'Boceto aprobado',
  'Pintura en proceso',
  'Obra terminada',
  'Esperando saldo',
  'Pago completo',
  'Lista para entregar',
  'Entregada',
  'Seguimiento al cliente',
]

const referencePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',
  'base64'
)

test('flujo principal de cliente a seguimiento', async ({ page }) => {
  test.setTimeout(120_000)

  await page.addInitScript(() => {
    if (!sessionStorage.getItem('ak-e2e-storage-ready')) {
      localStorage.clear()
      sessionStorage.clear()
      sessionStorage.setItem('ak-e2e-storage-ready', 'true')
    }
  })

  const orderCard = () => page.locator('.order-card').filter({ hasText: QUOTE_TITLE })

  const storedQuote = async () => page.evaluate((title) => {
    const quotes = JSON.parse(localStorage.getItem('ak-quotes-v1') || '[]')
    return quotes.find((quote) => quote.title === title) || null
  }, QUOTE_TITLE)

  const openOrders = async () => {
    const ordersNavigation = page.getByRole('button', { name: /Pedidos/ })
    await ordersNavigation.click()
    await expect(page.getByRole('heading', { name: 'Mis encargos' })).toBeVisible()
  }

  const advanceTo = async (status) => {
    const card = orderCard()
    await expect(card).toBeVisible()
    const select = card.locator('select[data-status-id]')
    await expect(select).toBeEnabled()
    await select.selectOption({ label: status })

    const confirmation = card.locator('.workflow-confirm-button')
    await expect(confirmation).toContainText(status)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      confirmation.click(),
    ])

    await expect(page.getByRole('heading', { name: 'Mis encargos' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Pedidos/ })).toHaveClass(/active/)
    await expect(orderCard().locator('.status-pill')).toHaveText(status)
    await expect.poll(async () => (await storedQuote())?.status).toBe(status)
  }

  await test.step('iniciar con almacenamiento limpio', async () => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Mi taller creativo' })).toBeVisible()
    await expect.poll(async () => page.evaluate(() => sessionStorage.getItem('ak-e2e-storage-ready'))).toBe('true')
  })

  await test.step('crear un cliente identificable', async () => {
    const clientsNavigation = page.getByRole('button', { name: /Clientes/ })
    await clientsNavigation.click()
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible()
    await page.getByRole('button', { name: /Agregar/ }).click()

    await page.getByLabel('Nombre', { exact: true }).fill(CLIENT_NAME)
    await page.getByLabel('WhatsApp', { exact: true }).fill('8330000000')
    await page.getByLabel('Instagram', { exact: true }).fill('@cliente_e2e_v2')
    await page.getByLabel('Qué le gusta', { exact: true }).fill('Datos exclusivos de la prueba E2E')
    await page.getByLabel('Próxima acción', { exact: true }).fill('Preparar cotización E2E')
    await page.getByRole('button', { name: 'Guardar cliente' }).click()

    const clientCard = page.locator('.client-card').filter({ hasText: CLIENT_NAME })
    await expect(clientCard).toBeVisible()
    await expect.poll(async () => page.evaluate((name) => {
      const clients = JSON.parse(localStorage.getItem('ak-clients-v1') || '[]')
      return clients.some((client) => client.name === name)
    }, CLIENT_NAME)).toBe(true)

    await clientCard.getByRole('button', { name: 'Cotizar' }).click()
  })

  await test.step('cargar una referencia creada en memoria y aplicar JoCe', async () => {
    await expect(page.getByRole('heading', { name: 'Calcular precio' })).toBeVisible()
    await page.getByLabel('Nombre de la obra').fill(QUOTE_TITLE)
    await page.getByLabel('Personas').fill('1')
    await page.getByLabel('Mascotas').fill('0')

    await page.locator('#ak-reference-photo').setInputFiles({
      name: 'referencia-e2e.png',
      mimeType: 'image/png',
      buffer: referencePng,
    })

    await expect(page.locator('#ak-photo-preview')).toBeVisible()
    await expect(page.locator('#ak-analysis-status')).toContainText('Análisis visual terminado')
    await expect(page.getByText('ANÁLISIS DE JOCE', { exact: true })).toBeVisible()
    await expect(page.getByText('Fondo sugerido', { exact: true })).toBeVisible()
    await expect(page.getByText('Horas sugeridas', { exact: true })).toBeVisible()
    await expect(page.getByText('Precio orientativo', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Aplicar sugerencias de JoCe' }).click()
    await expect(page.locator('#ak-analysis-status')).toContainText('Sugerencias aplicadas')
    await expect(page.getByLabel('Horas estimadas')).not.toHaveValue('0')
  })

  await test.step('guardar la cotización y crear el pedido', async () => {
    await expect(page.locator('#price-result')).toContainText('PRECIO SUGERIDO')
    await page.getByRole('button', { name: 'Guardar cotización' }).click()

    await expect(page.getByRole('heading', { name: 'Mis encargos' })).toBeVisible()
    await expect(orderCard()).toBeVisible()
    await expect(orderCard().locator('.status-pill')).toHaveText('Borrador')

    const quote = await storedQuote()
    expect(quote).not.toBeNull()
    expect(quote.clientId).toBeTruthy()
    expect(quote.price.suggestedPrice).toBeGreaterThan(0)
    expect(quote.price.deposit).toBeGreaterThan(0)
    expect(quote.price.deposit).toBeLessThanOrEqual(quote.price.suggestedPrice)
  })

  await test.step('avanzar por anticipo, producción, pago y entrega', async () => {
    for (const status of workflow) {
      await advanceTo(status)

      if (status === 'Anticipo recibido') {
        const quote = await storedQuote()
        expect(quote.price.deposit).toBeGreaterThan(0)
        await expect(orderCard()).toContainText(`Anticipo`)
      }

      if (status === 'Pago completo') {
        const quote = await storedQuote()
        expect(quote.paidAt).toBeTruthy()
        await expect(orderCard().locator('.balance-paid')).toContainText('$0')
      }
    }
  })

  await test.step('registrar y persistir el seguimiento', async () => {
    const card = orderCard()
    await expect(card.getByRole('heading', { name: 'Seguimiento después de la entrega' })).toBeVisible()

    await card.getByLabel('Mensaje').selectOption('complete')
    await expect(card.getByLabel('Texto para el cliente')).toHaveValue(new RegExp(CLIENT_NAME.split(' ')[0]))
    await card.getByLabel('Reseña recibida').check()
    await card.getByLabel('Foto recibida').check()
    await card.getByRole('checkbox', { name: 'Permiso para publicar', exact: true }).check()
    await card.getByLabel('Recordarme dar seguimiento').fill(REMINDER_DATE)
    await card.getByRole('button', { name: 'Guardar recordatorio' }).click()
    await expect(card.locator('[data-followup-saved]')).toContainText('Recordatorio guardado')

    const quote = await storedQuote()
    const followup = await page.evaluate((quoteId) => {
      const records = JSON.parse(localStorage.getItem('ak-followups-v1') || '{}')
      return records[quoteId] || null
    }, quote.id)

    expect(followup).toMatchObject({
      reviewReceived: true,
      photoReceived: true,
      permissionGranted: true,
      reminderDate: REMINDER_DATE,
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await openOrders()
    const reloadedCard = orderCard()
    await expect(reloadedCard.getByLabel('Reseña recibida')).toBeChecked()
    await expect(reloadedCard.getByLabel('Foto recibida')).toBeChecked()
    await expect(reloadedCard.getByRole('checkbox', { name: 'Permiso para publicar', exact: true })).toBeChecked()
    await expect(reloadedCard.getByLabel('Recordarme dar seguimiento')).toHaveValue(REMINDER_DATE)
  })
})
