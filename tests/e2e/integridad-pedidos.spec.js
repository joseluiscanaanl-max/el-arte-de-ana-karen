const { test, expect } = require('@playwright/test')

const PROTECTED_ID = 'quote-integrity-protected'
const PROTECTED_TITLE = 'Pedido con pago protegido'
const DRAFT_ID = 'quote-integrity-draft'
const DRAFT_TITLE = 'Borrador eliminable'
const LEDGER_KEY = 'ak-payments-ledger-v1'

test('protege pedidos con historial y permite eliminar solo borradores limpios', async ({ page }) => {
  test.setTimeout(90_000)

  await page.addInitScript(({ protectedId, protectedTitle, draftId, draftTitle, ledgerKey }) => {
    if (sessionStorage.getItem('ak-order-integrity-ready')) return
    localStorage.clear()
    sessionStorage.clear()
    sessionStorage.setItem('ak-order-integrity-ready', 'true')

    const price = {
      suggestedPrice: 1000,
      deposit: 500,
      balance: 500,
      profit: 300,
    }
    localStorage.setItem('ak-quotes-v1', JSON.stringify([
      {
        id: protectedId,
        clientId: null,
        title: protectedTitle,
        width: 30,
        height: 40,
        technique: 'Acrílico',
        status: 'Borrador',
        createdAt: '2026-08-09T10:00:00.000Z',
        updatedAt: '2026-08-09T10:00:00.000Z',
        price,
      },
      {
        id: draftId,
        clientId: null,
        title: draftTitle,
        width: 20,
        height: 30,
        technique: 'Acrílico',
        status: 'Borrador',
        createdAt: '2026-08-09T10:00:00.000Z',
        updatedAt: '2026-08-09T10:00:00.000Z',
        price,
      },
    ]))
    localStorage.setItem(ledgerKey, JSON.stringify({
      schemaVersion: 1,
      movements: [],
      migrations: {
        v1Quotes: {
          completed: true,
          completedAt: '2026-08-09T10:00:00.000Z',
        },
      },
    }))
  }, {
    protectedId: PROTECTED_ID,
    protectedTitle: PROTECTED_TITLE,
    draftId: DRAFT_ID,
    draftTitle: DRAFT_TITLE,
    ledgerKey: LEDGER_KEY,
  })

  const card = (title) => page.locator('.order-card').filter({ hasText: title })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Pedidos/ }).click()
  await expect(card(PROTECTED_TITLE)).toBeVisible()
  await expect(card(DRAFT_TITLE)).toBeVisible()

  await test.step('registrar un pago bloquea la edición retroactiva', async () => {
    const section = card(PROTECTED_TITLE).locator('.order-payments')
    await section.getByRole('button', { name: 'Registrar pago' }).click()
    const dialog = section.getByRole('dialog', { name: 'Registrar pago' })
    await dialog.getByLabel('Tipo de pago').selectOption('deposit')
    await dialog.getByLabel('Importe en pesos').fill('100.00')
    await dialog.getByLabel('Nota (opcional)').fill('Pago que protege el historial')
    await dialog.getByRole('button', { name: 'Guardar pago' }).click()
    await expect(dialog).not.toBeVisible()

    let warning = ''
    page.once('dialog', async (dialogEvent) => {
      warning = dialogEvent.message()
      expect(dialogEvent.type()).toBe('alert')
      await dialogEvent.accept()
    })
    await card(PROTECTED_TITLE).getByRole('button', { name: 'Editar' }).click()
    expect(warning).toContain('ya tiene pagos registrados')
    await expect(page.getByRole('heading', { name: 'Mis encargos' })).toBeVisible()
    await expect(card(PROTECTED_TITLE)).toBeVisible()
  })

  await test.step('el pedido con pago tampoco puede eliminarse', async () => {
    let warning = ''
    page.once('dialog', async (dialogEvent) => {
      warning = dialogEvent.message()
      expect(dialogEvent.type()).toBe('alert')
      await dialogEvent.accept()
    })
    await card(PROTECTED_TITLE).getByRole('button', { name: 'Eliminar' }).click()
    expect(warning).toContain('solo se pueden eliminar borradores sin pagos ni seguimiento')
    await expect(card(PROTECTED_TITLE)).toBeVisible()

    const state = await page.evaluate(({ quoteId, ledgerKey }) => ({
      quoteExists: JSON.parse(localStorage.getItem('ak-quotes-v1') || '[]').some((quote) => quote.id === quoteId),
      movements: JSON.parse(localStorage.getItem(ledgerKey) || '{}').movements || [],
    }), { quoteId: PROTECTED_ID, ledgerKey: LEDGER_KEY })
    expect(state.quoteExists).toBe(true)
    expect(state.movements.some((movement) => movement.quoteId === PROTECTED_ID)).toBe(true)
  })

  await test.step('un borrador sin historial conserva la eliminación normal', async () => {
    page.once('dialog', async (dialogEvent) => {
      expect(dialogEvent.type()).toBe('confirm')
      await dialogEvent.accept()
    })
    await card(DRAFT_TITLE).getByRole('button', { name: 'Eliminar' }).click()
    await expect(card(DRAFT_TITLE)).not.toBeVisible()

    const exists = await page.evaluate((quoteId) => {
      const quotes = JSON.parse(localStorage.getItem('ak-quotes-v1') || '[]')
      return quotes.some((quote) => quote.id === quoteId)
    }, DRAFT_ID)
    expect(exists).toBe(false)
  })
})
