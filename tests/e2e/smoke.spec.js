const { test, expect } = require('@playwright/test')

test('la aplicación abre correctamente', async ({ page }) => {
  const pageErrors = []
  const failedLocalResponses = []

  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    if (response.url().startsWith('http://127.0.0.1:4173') && response.status() >= 400) {
      failedLocalResponses.push(`${response.status()} ${response.url()}`)
    }
  })

  await page.goto('/', { waitUntil: 'networkidle' })

  await expect(page).toHaveTitle('El Arte de Ana Karen')
  await expect(page.locator('#app .app-shell')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mi taller creativo' })).toBeVisible()
  expect(pageErrors).toEqual([])
  expect(failedLocalResponses).toEqual([])
})
