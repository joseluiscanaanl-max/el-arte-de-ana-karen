const { test, expect } = require('@playwright/test')

test('JoCe prepara la cotización para WhatsApp con empaque, envío y cierre personalizado', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ak-clients-v1', JSON.stringify([{
      id: 'cliente-whatsapp',
      name: 'María',
      whatsapp: '528330000000',
      createdAt: '2026-08-10T10:00:00.000Z',
    }, {
      id: 'cliente-whatsapp-hombre',
      name: 'Carlos',
      whatsapp: '528330000001',
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
    }, {
      id: 'cotizacion-whatsapp-hombre',
      clientId: 'cliente-whatsapp-hombre',
      title: 'Retrato especial',
      width: 40,
      height: 30,
      technique: 'Acrílico',
      depositPercent: 50,
      deliveryDate: '',
      notes: '',
      status: 'Borrador',
      createdAt: '2026-08-10T10:00:00.000Z',
      updatedAt: '2026-08-10T10:00:00.000Z',
      price: {
        suggestedPrice: 5000,
        deposit: 2500,
        balance: 2500,
        profit: 1500,
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
  expect(payload.text).toContain('Sabemos lo especiales que son los recuerdos plasmados en una obra de arte.')
  expect(payload.text).toContain('Espero que estés tan entusiasmada como yo para iniciar tu obra cuanto antes.')
  expect(payload.text).toContain('Agradecida por tu preferencia, quedo en espera de tu confirmación.')
  expect(payload.text).toContain('Saludos 😊')
  expect(payload.text).toContain('El Arte de Ana Karen')

  const malePayload = await page.evaluate(() => window.AKQuoteShare.buildQuoteMessage('cotizacion-whatsapp-hombre'))
  expect(malePayload).toBeTruthy()
  expect(malePayload.text).toContain('Hola Carlos.')
  expect(malePayload.text).toContain('Espero que estés tan entusiasmado como yo para iniciar tu obra cuanto antes.')
  expect(malePayload.text).not.toContain('entusiasmada como yo')
})
