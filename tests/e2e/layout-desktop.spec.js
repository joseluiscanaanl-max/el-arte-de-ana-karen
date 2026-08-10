const { test, expect } = require('@playwright/test')

test('Cotizar no recorta el catálogo ni el precio recomendado en escritorio', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#ak-approved-fixed-view-style', { state: 'attached' })

  await page.evaluate(() => {
    const host = document.querySelector('.main-content')
    if (!host) throw new Error('No existe .main-content')

    const catalog = document.createElement('section')
    catalog.id = 'ak-approved-canvas-catalog'
    catalog.className = 'ak-approved-catalog ak-approved-fixed-catalog'
    catalog.innerHTML = `
      <div class="ak-approved-catalog__head">
        <h4>Catálogo de lienzos y precio recomendado</h4>
        <p>JoCe considera el tamaño, la cantidad de pintura, el fondo elegido, las personas y las horas de trabajo.</p>
      </div>
      <div class="ak-approved-catalog__list">
        <button type="button" class="ak-approved-size">
          <span class="ak-approved-size__radio"></span>
          <span class="ak-approved-size__main">
            <span class="ak-approved-size__title"><strong>50 × 40 cm</strong><span class="ak-approved-size__label">Recomendado</span></span>
            <span class="ak-approved-size__materials">Lienzo $950 · pintura y sellado $350</span>
          </span>
          <span class="ak-approved-size__hours">18–24 h · cálculo 18 h</span>
        </button>
      </div>
      <p class="ak-approved-catalog__note">Más tamaño = más lienzo, más pintura y más horas.</p>
      <div class="ak-approved-price">
        <div class="ak-approved-price__preview">
          <canvas></canvas>
          <small>Vista elegida: <strong>Fondo sencillo</strong></small>
        </div>
        <div class="ak-approved-price__details">
          <h5>Precio sugerido por JoCe</h5>
          <div class="ak-approved-price__row"><span>Personas</span><strong>2</strong></div>
          <div class="ak-approved-price__row"><span>Tamaño</span><strong>50 × 40 cm</strong></div>
          <div class="ak-approved-price__row"><span>Lienzo</span><strong>$950</strong></div>
          <div class="ak-approved-price__row"><span>Pintura y sellado</span><strong>$350</strong></div>
          <div class="ak-approved-price__total"><span>Precio recomendado</span><strong>$7,000</strong></div>
        </div>
      </div>
      <div class="ak-approved-catalog__actions"><button type="button">Cambiar</button><button type="button">Usar precio</button></div>
    `
    host.prepend(catalog)
  })

  const metrics = await page.locator('#ak-approved-canvas-catalog').evaluate((catalog) => {
    const host = catalog.closest('.main-content')
    const price = catalog.querySelector('.ak-approved-price')
    const heading = catalog.querySelector('.ak-approved-price__details h5')
    const catalogRect = catalog.getBoundingClientRect()
    const hostRect = host.getBoundingClientRect()
    const priceRect = price.getBoundingClientRect()
    const headingRect = heading.getBoundingClientRect()
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      hostRight: hostRect.right,
      catalogLeft: catalogRect.left,
      catalogRight: catalogRect.right,
      priceRight: priceRect.right,
      headingRight: headingRect.right,
      catalogWidth: catalogRect.width,
      priceWidth: priceRect.width,
    }
  })

  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth)
  expect(metrics.catalogRight).toBeLessThanOrEqual(metrics.hostRight + 1)
  expect(metrics.priceRight).toBeLessThanOrEqual(metrics.catalogRight + 1)
  expect(metrics.headingRight).toBeLessThanOrEqual(metrics.catalogRight + 1)
  expect(metrics.priceWidth).toBeLessThanOrEqual(metrics.catalogWidth + 1)
})

test('el resumen financiero conserva la tabla completa en escritorio', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('ak-clients-v1', JSON.stringify([
      { id: 'client-desktop', name: 'Cliente Escritorio', createdAt: '2026-08-10T10:00:00.000Z' },
    ]))
    localStorage.setItem('ak-quotes-v1', JSON.stringify([{
      id: 'quote-desktop', clientId: 'client-desktop', title: 'Obra de escritorio', width: 50, height: 70,
      technique: 'Acrílico', status: 'Borrador', createdAt: '2026-08-10T10:00:00.000Z', updatedAt: '2026-08-10T10:00:00.000Z',
      price: { suggestedPrice: 7550, deposit: 3775, balance: 3775, profit: 2500 },
    }]))
    localStorage.setItem('ak-payments-ledger-v1', JSON.stringify({
      schemaVersion: 1,
      movements: [],
      migrations: { v1Quotes: { completed: true, completedAt: '2026-08-10T10:00:00.000Z' } },
    }))
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const table = page.locator('.ak-finance-table')
  const clientRow = page.locator('[data-ak-finance-client-row="client-desktop"]')
  await expect(table).toBeVisible()
  await expect(page.locator('.ak-finance-mobile-list')).toHaveCount(0)
  await expect(clientRow.locator('[data-ak-finance-value="quoted"]')).toHaveText('$7,550.00')
  await expect(clientRow.locator('[data-ak-finance-value="paid"]')).toHaveText('$0.00')
  await expect(clientRow.locator('[data-ak-finance-value="pending"]')).toHaveText('$7,550.00')

  const geometry = await page.locator('.ak-finance-table-wrap').evaluate((wrapper) => ({
    clientWidth: wrapper.clientWidth,
    scrollWidth: wrapper.scrollWidth,
    right: wrapper.getBoundingClientRect().right,
    viewportWidth: document.documentElement.clientWidth,
  }))
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth)

  await clientRow.getByRole('button', { name: /Cliente Escritorio/ }).click()
  await expect(page.locator('[data-ak-finance-quote-id="quote-desktop"]')).toBeVisible()
})
