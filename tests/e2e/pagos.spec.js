const { test, expect } = require('@playwright/test')

const QUOTE_ID = 'quote-e2e-payments-v2'
const QUOTE_TITLE = 'Pedido E2E Pagos V2'
const LEDGER_KEY = 'ak-payments-ledger-v1'

test('registra y persiste pagos reales sin modificar el estado del pedido', async ({ page }) => {
  test.setTimeout(90_000)

  await page.addInitScript(({ quoteId, quoteTitle, ledgerKey }) => {
    if (sessionStorage.getItem('ak-payments-e2e-ready')) return
    localStorage.clear()
    sessionStorage.clear()
    sessionStorage.setItem('ak-payments-e2e-ready', 'true')
    localStorage.setItem('ak-quotes-v1', JSON.stringify([{
      id: quoteId,
      clientId: null,
      title: quoteTitle,
      width: 30,
      height: 40,
      technique: 'Acrílico',
      status: 'Borrador',
      createdAt: '2026-08-07T12:00:00.000Z',
      updatedAt: '2026-08-07T12:00:00.000Z',
      price: {
        suggestedPrice: 1000,
        deposit: 500,
        balance: 500,
        profit: 300,
      },
    }]))
    localStorage.setItem(ledgerKey, JSON.stringify({
      schemaVersion: 1,
      movements: [],
      migrations: {
        v1Quotes: {
          completed: true,
          completedAt: '2026-08-07T12:00:00.000Z',
        },
      },
    }))
  }, { quoteId: QUOTE_ID, quoteTitle: QUOTE_TITLE, ledgerKey: LEDGER_KEY })

  const orderCard = () => page.locator('.order-card').filter({ hasText: QUOTE_TITLE })
  const paymentSection = () => orderCard().locator('.order-payments')

  const openOrders = async () => {
    await page.getByRole('button', { name: /Pedidos/ }).click()
    await expect(page.getByRole('heading', { name: 'Mis encargos' })).toBeVisible()
    await expect(orderCard()).toBeVisible()
  }

  const expectSummary = async ({ paid, balance, depositStatus }) => {
    const section = paymentSection()
    await expect(section.locator('[data-payment-paid]')).toHaveText(paid)
    await expect(section.locator('[data-payment-balance]')).toHaveText(balance)
    await expect(section.locator('[data-payment-deposit-status]')).toHaveText(depositStatus)
  }

  const registerPayment = async ({ category, amount, method, note }) => {
    const section = paymentSection()
    await section.getByRole('button', { name: 'Registrar pago' }).click()
    const dialog = section.getByRole('dialog', { name: 'Registrar pago' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Tipo de pago').selectOption(category)
    await dialog.getByLabel('Importe en pesos').fill(amount)
    await expect(dialog.getByLabel('Fecha del pago')).not.toHaveValue('')
    if (method) await dialog.getByLabel('Método de pago (opcional)').selectOption(method)
    if (note) await dialog.getByLabel('Nota (opcional)').fill(note)
    await dialog.getByRole('button', { name: 'Guardar pago' }).click()
    await expect(dialog).not.toBeVisible()
  }

  await test.step('mostrar pedido sin pagos y valores financieros reales', async () => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await openOrders()
    const section = paymentSection()
    await expect(section.locator('[data-payment-total]')).toHaveText('$1,000.00')
    await expect(section.locator('[data-payment-deposit]')).toHaveText('$500.00')
    await expectSummary({ paid: '$0.00', balance: '$1,000.00', depositStatus: 'Anticipo pendiente' })
    await section.getByText('Historial de movimientos').click()
    await expect(section.getByText('Aún no hay pagos registrados.')).toBeVisible()
  })

  await test.step('primer abono inferior al anticipo', async () => {
    await registerPayment({ category: 'deposit', amount: '200.00', method: 'transfer', note: 'Primer abono E2E' })
    await expectSummary({ paid: '$200.00', balance: '$800.00', depositStatus: 'Anticipo pendiente' })
  })

  await test.step('varios abonos cubren el anticipo solo al alcanzar el requerido', async () => {
    await registerPayment({ category: 'partial', amount: '300', method: 'cash', note: 'Segundo abono E2E' })
    await expectSummary({ paid: '$500.00', balance: '$500.00', depositStatus: 'Anticipo cubierto' })
  })

  await test.step('advertir y exigir confirmación explícita antes de un sobrepago', async () => {
    const section = paymentSection()
    await section.getByRole('button', { name: 'Registrar pago' }).click()
    const dialog = section.getByRole('dialog', { name: 'Registrar pago' })
    await dialog.getByLabel('Importe en pesos').fill('600.00')
    await dialog.getByRole('button', { name: 'Guardar pago' }).click()
    await expect(dialog.getByText('El importe supera el saldo pendiente')).toBeVisible()
    await expect(dialog.getByLabel('Confirmo que deseo registrar este sobrepago')).not.toBeChecked()
    const movementCount = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).movements.length, LEDGER_KEY)
    expect(movementCount).toBe(2)
    await dialog.getByRole('button', { name: 'Cerrar' }).click()
  })

  await test.step('pago final alcanza el total y mantiene el estado independiente', async () => {
    await registerPayment({ category: 'final', amount: '500.00', method: 'card', note: 'Pago final E2E' })
    await expectSummary({ paid: '$1,000.00', balance: '$0.00', depositStatus: 'Anticipo cubierto' })
    await expect(orderCard().locator('.status-pill')).toHaveText('Borrador')
    await expect(paymentSection().locator('.payment-history-item')).toHaveCount(3)
    await expect(paymentSection()).toContainText('Primer abono E2E')
    await expect(paymentSection()).toContainText('Segundo abono E2E')
    await expect(paymentSection()).toContainText('Pago final E2E')

    const persisted = await page.evaluate(({ ledgerKey, quoteId }) => {
      const ledger = JSON.parse(localStorage.getItem(ledgerKey))
      const quote = JSON.parse(localStorage.getItem('ak-quotes-v1')).find((item) => item.id === quoteId)
      return { movementCount: ledger.movements.length, amounts: ledger.movements.map((item) => item.amountMinor), status: quote.status }
    }, { ledgerKey: LEDGER_KEY, quoteId: QUOTE_ID })
    expect(persisted).toEqual({ movementCount: 3, amounts: [20000, 30000, 50000], status: 'Borrador' })
  })

  await test.step('persistir totales e historial después de recargar', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await openOrders()
    await expectSummary({ paid: '$1,000.00', balance: '$0.00', depositStatus: 'Anticipo cubierto' })
    await paymentSection().getByText('Historial de movimientos').click()
    await expect(paymentSection().locator('.payment-history-item')).toHaveCount(3)
    await expect(orderCard().locator('.status-pill')).toHaveText('Borrador')
  })

  await test.step('bloquear registros cuando el ledger está corrupto sin sobrescribirlo', async () => {
    const corruptRaw = '{ledger-de-pagos-dañado'
    await page.evaluate(({ ledgerKey, raw }) => localStorage.setItem(ledgerKey, raw), { ledgerKey: LEDGER_KEY, raw: corruptRaw })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await openOrders()

    const section = paymentSection()
    await expect(section.getByRole('alert')).toContainText('ledger está dañado')
    await expect(section.getByRole('button', { name: 'Registrar pago' })).toBeDisabled()
    await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), LEDGER_KEY)).toBe(corruptRaw)
  })
})
