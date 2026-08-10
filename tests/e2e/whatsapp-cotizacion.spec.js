const { test, expect } = require('@playwright/test')

test('JoCe prepara la cotización para WhatsApp con empaque y envío por separado', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ak-clients-v1', JSON.stringify([{
      id: 'cliente-whatsapp',
      name: 'María',
      whatsapp: '528330000000',
      createdAt: '2026-08-10T10:00:00.000Z',
    }]))

    localStorage.setItem('ak-quotes-v1', JSON.stringify([{
      id: 'cotizacion-whatsapp',
      clientId: 'cliente-whatsapp',
      title: 'Retrato familiar',
      width: 50,
      height: 40,
      technique: 'Acrílico',
      depositPercent: 50,
      deliveryDate: '2026-08-30',
      notes: 'Incluye una revisión del boceto.',
      status: 'Borrador',
      createdAt: '2026-08-10T10:00:00.000Z',
      updatedAt: '2026-08-10T10:00:00.000Z',
      price: {
        suggestedPrice: 7000,
        deposit: 3500,
        balance: 3500,
        profit: 2000,
      },
    }]))

    localStorage.setItem('ak-promotions-v1', '[]')

    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (payload) => {
        window.__akQuoteSharePayload = payload
      },
    })
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Pedidos/ }).click()

  const order = page.locator('.order-card').filter({ hasText: 'Retrato familiar' })
  await expect(order).toBeVisible()
  await order.getByRole('button', { name: 'Compartir' }).click()

  const payload = await page.evaluate(() => window.__akQuoteSharePayload)
  expect(payload).toBeTruthy()
  expect(payload.title).toBe('Cotización: Retrato familiar')
  expect(payload.text).toContain('Hola María.')
  expect(payload.text).toContain('Gracias por tu interés en cotizar tu obra con nuestro arte. 🎨')
  expect(payload.text).toContain('Material y mano de obra: $7,000')
  expect(payload.text).toContain('El empaque y el envío se cotizan por separado.')
  expect(payload.text).toContain('Para cotizar el envío con mensajería, por favor compártenos el domicilio completo de destino: calle, número, colonia, código postal, ciudad y estado.')
  expect(payload.text).toContain('Gracias por confiar en El Arte de Ana Karen.')
})
