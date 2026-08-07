const { test, expect } = require('@playwright/test')

const LEDGER_KEY = 'ak-payments-ledger-v1'
const MAIN_ID = 'quote-workflow-finance'
const MAIN_TITLE = 'Pedido workflow financiero'
const CANCEL_ID = 'quote-workflow-cancel'
const CANCEL_TITLE = 'Pedido cancelable financiero'

test('el workflow valida pagos reales sin crear ni inferir movimientos', async ({ page }) => {
  test.setTimeout(120_000)

  await page.addInitScript(({ ledgerKey, mainId, mainTitle, cancelId, cancelTitle }) => {
    if (sessionStorage.getItem('ak-workflow-finance-ready')) return
    localStorage.clear()
    sessionStorage.clear()
    sessionStorage.setItem('ak-workflow-finance-ready', 'true')
    localStorage.setItem('ak-quotes-v1', JSON.stringify([
      {
        id: mainId, clientId: null, title: mainTitle, width: 30, height: 40, technique: 'Acrílico',
        status: 'Borrador', createdAt: '2026-08-07T10:00:00.000Z', updatedAt: '2026-08-07T10:00:00.000Z',
        price: { suggestedPrice: 1000, deposit: 500, balance: 500, profit: 300 },
      },
      {
        id: cancelId, clientId: null, title: cancelTitle, width: 20, height: 20, technique: 'Acrílico',
        status: 'Borrador', createdAt: '2026-08-07T10:00:00.000Z', updatedAt: '2026-08-07T10:00:00.000Z',
        price: { suggestedPrice: 600, deposit: 300, balance: 300, profit: 180 },
      },
    ]))
    localStorage.setItem(ledgerKey, JSON.stringify({
      schemaVersion: 1,
      movements: [],
      migrations: { v1Quotes: { completed: true, completedAt: '2026-08-07T10:00:00.000Z' } },
    }))
  }, {
    ledgerKey: LEDGER_KEY,
    mainId: MAIN_ID,
    mainTitle: MAIN_TITLE,
    cancelId: CANCEL_ID,
    cancelTitle: CANCEL_TITLE,
  })

  const card = (title) => page.locator('.order-card').filter({ hasText: title })
  const mainCard = () => card(MAIN_TITLE)

  const storedStatus = (quoteId) => page.evaluate((id) => {
    const quote = JSON.parse(localStorage.getItem('ak-quotes-v1')).find((item) => item.id === id)
    return quote?.status
  }, quoteId)

  const movementCount = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).movements.length, LEDGER_KEY)

  const selectTarget = async (target, title = MAIN_TITLE) => {
    const order = card(title)
    await order.locator('select[data-status-id]').selectOption({ label: target })
    return order.locator('.workflow-confirm-button')
  }

  const expectBlocked = async (target, message, expectedStatus) => {
    const confirmation = await selectTarget(target)
    let alertMessage = ''
    page.once('dialog', async (alert) => {
      alertMessage = alert.message()
      await alert.accept()
    })
    await confirmation.click()
    expect(alertMessage).toContain(message)
    await expect.poll(() => storedStatus(MAIN_ID)).toBe(expectedStatus)
  }

  const advance = async (target, title = MAIN_TITLE, quoteId = MAIN_ID) => {
    const confirmation = await selectTarget(target, title)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      confirmation.click(),
    ])
    await expect(page.getByRole('heading', { name: 'Mis encargos' })).toBeVisible()
    await expect.poll(() => storedStatus(quoteId)).toBe(target)
  }

  const registerPayment = async ({ amount, category, note }) => {
    const section = mainCard().locator('.order-payments')
    await section.getByRole('button', { name: 'Registrar pago' }).click()
    const dialog = section.getByRole('dialog', { name: 'Registrar pago' })
    await dialog.getByLabel('Tipo de pago').selectOption(category)
    await dialog.getByLabel('Importe en pesos').fill(amount)
    await dialog.getByLabel('Nota (opcional)').fill(note)
    await dialog.getByRole('button', { name: 'Guardar pago' }).click()
    await expect(dialog).not.toBeVisible()
  }

  await test.step('iniciar con pedidos y ledger vacío', async () => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Pedidos/ }).click()
    await expect(mainCard()).toBeVisible()
    expect(await movementCount()).toBe(0)
  })

  await test.step('bloquear Anticipo recibido sin pago real', async () => {
    await expectBlocked('Anticipo recibido', 'Primero registra un pago', 'Borrador')
    expect(await movementCount()).toBe(0)
  })

  await test.step('un primer pago permite Anticipo recibido sin crear movimientos adicionales', async () => {
    await registerPayment({ amount: '200.00', category: 'deposit', note: 'Primer pago workflow E2E' })
    expect(await movementCount()).toBe(1)
    await advance('Anticipo recibido')
    expect(await movementCount()).toBe(1)
  })

  await test.step('bloquear producción hasta cubrir completamente el anticipo', async () => {
    await expectBlocked('Boceto en proceso', 'Faltan $300.00 para cubrir el anticipo', 'Anticipo recibido')
    await registerPayment({ amount: '300.00', category: 'partial', note: 'Anticipo completado workflow E2E' })
    await advance('Boceto en proceso')
    expect(await movementCount()).toBe(2)
  })

  await test.step('los estados de producción no crean pagos y Pago completo exige saldo cero', async () => {
    await advance('Esperando saldo')
    expect(await movementCount()).toBe(2)
    await expectBlocked('Pago completo', 'Faltan $500.00 para marcar este pedido como Pago completo', 'Esperando saldo')
    expect(await movementCount()).toBe(2)
  })

  await test.step('cubrir el precio permite Pago completo sin crear paidAt ni saldo visual falso', async () => {
    await registerPayment({ amount: '500.00', category: 'final', note: 'Pago final workflow E2E' })
    await advance('Pago completo')
    expect(await movementCount()).toBe(3)
    const quote = await page.evaluate((id) => JSON.parse(localStorage.getItem('ak-quotes-v1')).find((item) => item.id === id), MAIN_ID)
    expect(quote.paidAt).toBeUndefined()
    await expect(mainCard().locator('.order-money span').nth(1).locator('b')).not.toHaveText('$0')
    await expect(mainCard().locator('[data-payment-balance]')).toHaveText('$0.00')
  })

  await test.step('un reverso no retrocede el estado pero bloquea el siguiente avance', async () => {
    const section = mainCard().locator('.order-payments')
    await section.getByText('Historial de movimientos').click()
    const finalPayment = section.locator('.payment-history-item').filter({ hasText: 'Pago final workflow E2E' })
    await finalPayment.getByRole('button', { name: 'Corregir pago' }).click()
    const dialog = section.getByRole('dialog', { name: 'Corregir pago' })
    await dialog.getByLabel('Motivo de la corrección').fill('Reverso para validar workflow E2E')
    await dialog.getByLabel(/Confirmo que deseo registrar esta corrección/).check()
    await dialog.getByRole('button', { name: 'Guardar corrección' }).click()

    await expect.poll(() => storedStatus(MAIN_ID)).toBe('Pago completo')
    await expect(mainCard().locator('.workflow-financial-warning')).toContainText('Faltan $500.00')
    await expect(mainCard().locator('[data-payment-balance]')).toHaveText('$500.00')
    await expectBlocked('Lista para entregar', 'Faltan $500.00', 'Pago completo')
    expect(await movementCount()).toBe(4)
  })

  await test.step('un pago sustituto desbloquea el avance posterior', async () => {
    await registerPayment({ amount: '500.00', category: 'final', note: 'Pago sustituto workflow E2E' })
    await advance('Lista para entregar')
    expect(await movementCount()).toBe(5)
  })

  await test.step('Cancelada permanece disponible sin saldo', async () => {
    await advance('Cancelada', CANCEL_TITLE, CANCEL_ID)
    expect(await movementCount()).toBe(5)
  })

  await test.step('ledger corrupto bloquea transición financiera y conserva datos', async () => {
    const corruptRaw = '{workflow-ledger-dañado'
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: LEDGER_KEY, raw: corruptRaw })
    await expectBlocked('Entregada', 'ledger de pagos está dañado', 'Lista para entregar')
    await expect(mainCard().locator('.workflow-financial-warning')).toContainText('ledger de pagos está dañado')
    await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), LEDGER_KEY)).toBe(corruptRaw)
  })
})
