const { test, expect } = require('@playwright/test')

const BACKUP_KEYS = [
  'ak-settings-v1',
  'ak-clients-v1',
  'ak-quotes-v1',
  'ak-promotions-v1',
  'ak-followups-v1',
  'ak-payments-ledger-v1',
]

const validLedger = () => JSON.stringify({
  schemaVersion: 1,
  movements: [],
  migrations: { v1Quotes: { completed: true, completedAt: '2026-08-09T10:00:00.000Z' } },
})

const storageA = () => ({
  'ak-settings-v1': JSON.stringify({ hourlyRate: 150, marginPercent: 35, depositPercent: 50, indirectPercent: 10 }),
  'ak-clients-v1': JSON.stringify([{ id: 'webkit-client-a', name: 'Cliente WebKit A' }]),
  'ak-quotes-v1': JSON.stringify([{
    id: 'webkit-quote-a', clientId: 'webkit-client-a', title: 'Pedido WebKit A', width: 20, height: 30,
    technique: 'Acrílico', status: 'Borrador', createdAt: '2026-08-09T10:00:00.000Z', updatedAt: '2026-08-09T10:00:00.000Z',
    price: { suggestedPrice: 900, deposit: 450, balance: 450, profit: 250 },
  }]),
  'ak-promotions-v1': '[]',
  'ak-followups-v1': '{}',
  'ak-payments-ledger-v1': validLedger(),
})

const storageB = () => ({
  'ak-settings-v1': JSON.stringify({ hourlyRate: 240, marginPercent: 40, depositPercent: 60, indirectPercent: 12 }),
  'ak-clients-v1': JSON.stringify([{ id: 'webkit-client-b', name: 'Cliente WebKit Restaurado' }]),
  'ak-quotes-v1': JSON.stringify([{
    id: 'webkit-quote-b', clientId: 'webkit-client-b', title: 'Pedido WebKit restaurado', width: 30, height: 40,
    technique: 'Acrílico', status: 'Borrador', createdAt: '2026-08-09T10:00:00.000Z', updatedAt: '2026-08-09T10:00:00.000Z',
    price: { suggestedPrice: 1000, deposit: 600, balance: 400, profit: 300 },
  }]),
  'ak-promotions-v1': '[]',
  'ak-followups-v1': '{}',
  'ak-payments-ledger-v1': validLedger(),
})

const backup = (storage) => ({
  format: 'el-arte-de-ana-karen-backup',
  version: 2,
  exportedAt: '2026-08-09T12:00:00.000Z',
  storage,
})

const seed = async (page, values) => {
  await page.addInitScript((storage) => {
    if (sessionStorage.getItem('ak-webkit-backup-seeded')) return
    localStorage.clear()
    sessionStorage.setItem('ak-webkit-backup-seeded', 'true')
    Object.entries(storage).forEach(([key, value]) => localStorage.setItem(key, value))
  }, values)
}

const snapshot = (page) => page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), BACKUP_KEYS)

const openSettings = async (page) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByRole('heading', { name: 'Ajustes del taller' })).toBeVisible()
}

test('WebKit exporta el respaldo V2 con las seis claves', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'Cobertura específica para WebKit/iPhone')
  const current = storageA()
  await seed(page, current)
  await openSettings(page)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar respaldo' }).click()
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'))

  expect(exported.format).toBe('el-arte-de-ana-karen-backup')
  expect(exported.version).toBe(2)
  expect(Object.keys(exported.storage).sort()).toEqual([...BACKUP_KEYS].sort())
  expect(exported.storage).toEqual(current)
})

test('WebKit restaura las seis claves sin depender de waitForNavigation durante la descarga', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'Cobertura específica para WebKit/iPhone')
  const current = storageA()
  const target = storageB()
  await seed(page, current)
  await openSettings(page)

  await page.locator('#restore-backup-file').setInputFiles({
    name: 'respaldo-webkit-v2.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup(target))),
  })
  await expect(page.locator('[data-restore-preview]')).toBeVisible()
  await page.locator('[data-restore-confirm]').check()

  const safetyDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Restaurar las seis claves' }).click()
  await safetyDownload

  await expect.poll(async () => {
    try {
      return await snapshot(page)
    } catch {
      return null
    }
  }, { timeout: 10_000 }).toEqual(target)

  await page.waitForLoadState('domcontentloaded')
  expect(await snapshot(page)).toEqual(target)
  await expect(page.getByRole('heading', { name: 'Mi taller creativo' })).toBeVisible()
})
