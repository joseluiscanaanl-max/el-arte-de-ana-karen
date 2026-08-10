const { test, expect } = require('@playwright/test')

test('los ajustes del taller permanecen fijos hasta que se guarde otro cambio', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await page.getByRole('button', { name: 'Ajustes' }).click()
  const settings = page.locator('#settings-form')
  await settings.getByLabel('Valor de una hora de trabajo').fill('75')
  await settings.getByRole('button', { name: 'Guardar preferencias' }).click()

  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ak-settings-v1')).hourlyRate)).toBe(75)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.locator('#settings-form').getByLabel('Valor de una hora de trabajo')).toHaveValue('75')

  await page.locator('.bottom-nav [data-view="cotizar"]').click()
  await expect(page.getByLabel('Valor por hora')).toHaveValue('75')

  await page.getByLabel('Valor por hora').fill('120')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.locator('#settings-form').getByLabel('Valor de una hora de trabajo')).toHaveValue('75')

  await page.locator('#settings-form').getByLabel('Valor de una hora de trabajo').fill('90')
  await page.locator('#settings-form').getByRole('button', { name: 'Guardar preferencias' }).click()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.locator('#settings-form').getByLabel('Valor de una hora de trabajo')).toHaveValue('90')
})
