const { test, expect } = require('@playwright/test')

const BACKUP_KEYS = [
  'ak-settings-v1',
  'ak-clients-v1',
  'ak-quotes-v1',
  'ak-promotions-v1',
  'ak-followups-v1',
  'ak-payments-ledger-v1',
]

const makeBackup = (storage) => ({
  format: 'el-arte-de-ana-karen-backup',
  version: 2,
  exportedAt: '2026-08-07T12:00:00.000Z',
  storage,
})

const validLedger = () => JSON.stringify({
  schemaVersion: 1,
  movements: [
    {
      id: 'payment-backup', quoteId: 'quote-backup', type: 'payment', category: 'deposit', amountMinor: 30000,
      currency: 'MXN', occurredOn: '2026-08-07', method: 'transfer', note: 'Pago respaldado',
      createdAt: '2026-08-07T12:00:00.000Z', source: 'manual', inferred: false, migrated: false,
      needsReview: false, reversesMovementId: null, correctionReason: null,
    },
    {
      id: 'reversal-backup', quoteId: 'quote-backup', type: 'reversal', category: 'deposit', amountMinor: -30000,
      currency: 'MXN', occurredOn: '2026-08-07', method: null, note: 'Reverso respaldado',
      createdAt: '2026-08-07T13:00:00.000Z', source: 'manual', inferred: false, migrated: false,
      needsReview: false, reversesMovementId: 'payment-backup', correctionReason: 'Corrección respaldada',
    },
  ],
  migrations: { v1Quotes: { completed: true, completedAt: '2026-08-07T10:00:00.000Z' } },
})

const baseStorage = () => ({
  'ak-settings-v1': JSON.stringify({ hourlyRate: 200, marginPercent: 30, depositPercent: 50, indirectPercent: 10 }),
  'ak-clients-v1': JSON.stringify([{ id: 'client-backup', name: 'Cliente respaldo', whatsapp: '528330000000' }]),
  'ak-quotes-v1': JSON.stringify([{
    id: 'quote-backup', clientId: 'client-backup', title: 'Pedido respaldo', width: 20, height: 30,
    technique: 'Acrílico', status: 'Seguimiento al cliente', createdAt: '2026-08-07T10:00:00.000Z',
    updatedAt: '2026-08-07T10:00:00.000Z', price: { suggestedPrice: 600, deposit: 300, balance: 300, profit: 180 },
  }]),
  'ak-promotions-v1': JSON.stringify([{ id: 'promotion-backup', quoteId: 'quote-backup', caption: 'Promoción' }]),
  'ak-followups-v1': JSON.stringify({ 'quote-backup': { reviewReceived: true, reminderDate: '2026-08-20' } }),
  'ak-payments-ledger-v1': validLedger(),
})

const seedStorage = async (page, storage) => {
  await page.addInitScript((values) => {
    if (sessionStorage.getItem('ak-backup-e2e-seeded')) return
    localStorage.clear()
    sessionStorage.setItem('ak-backup-e2e-seeded', 'true')
    Object.entries(values).forEach(([key, value]) => {
      if (value !== null) localStorage.setItem(key, value)
    })
  }, storage)
}

const openSettings = async (page) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByRole('heading', { name: 'Ajustes del taller' })).toBeVisible()
}

const readDownloadJson = async (download) => {
  const stream = await download.createReadStream()
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const chooseBackup = async (page, backup) => {
  await page.locator('#restore-backup-file').setInputFiles({
    name: 'respaldo-v2.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  })
}

const rawSnapshot = (page) => page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), BACKUP_KEYS)

test('el respaldo V2 exporta exactamente las seis claves y conserva texto corrupto y ausencias', async ({ page }) => {
  const quoteCorrupt = '{cotización-corrupta-byte-por-byte'
  const ledgerCorrupt = '{ledger-corrupto-byte-por-byte'
  const storage = baseStorage()
  storage['ak-quotes-v1'] = quoteCorrupt
  storage['ak-followups-v1'] = null
  storage['ak-payments-ledger-v1'] = ledgerCorrupt
  await seedStorage(page, storage)
  await openSettings(page)

  await expect(page.getByRole('alert')).toContainText('ak-quotes-v1')
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('ak-quotes-v1'))).toBe(quoteCorrupt)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar respaldo' }).click()
  const backup = await readDownloadJson(await downloadPromise)

  expect(backup.format).toBe('el-arte-de-ana-karen-backup')
  expect(backup.version).toBe(2)
  expect(Object.keys(backup.storage).sort()).toEqual([...BACKUP_KEYS].sort())
  expect(backup.storage['ak-quotes-v1']).toBe(quoteCorrupt)
  expect(backup.storage['ak-payments-ledger-v1']).toBe(ledgerCorrupt)
  expect(backup.storage['ak-followups-v1']).toBeNull()
})

test('rechaza archivos externos inválidos o claves no autorizadas sin escribir', async ({ page }) => {
  const storage = baseStorage()
  await seedStorage(page, storage)
  await openSettings(page)
  const before = await rawSnapshot(page)

  await page.locator('#restore-backup-file').setInputFiles({
    name: 'invalido.json', mimeType: 'application/json', buffer: Buffer.from('{sin-json'),
  })
  await expect(page.locator('[data-restore-status]')).toHaveText('Este respaldo no es válido. No se cambió ningún dato.')
  expect(await rawSnapshot(page)).toEqual(before)

  await chooseBackup(page, {
    ...makeBackup(storage),
    storage: { ...storage, 'clave-no-autorizada': 'intrusión' },
  })
  await expect(page.locator('[data-restore-status]')).toHaveText('Este respaldo no es válido. No se cambió ningún dato.')
  expect(await rawSnapshot(page)).toEqual(before)
  expect(await page.evaluate(() => localStorage.getItem('clave-no-autorizada'))).toBeNull()
})

test('restaura exactamente las seis claves con pagos, reversos y seguimientos', async ({ page }) => {
  const current = baseStorage()
  current['ak-clients-v1'] = '[]'
  const target = baseStorage()
  await seedStorage(page, current)
  await openSettings(page)
  await chooseBackup(page, makeBackup(target))

  await expect(page.locator('[data-restore-preview]')).toBeVisible()
  await page.locator('[data-restore-confirm]').check()
  const safetyDownload = page.waitForEvent('download')
  const navigation = page.waitForNavigation({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Restaurar las seis claves' }).click()
  const safety = await readDownloadJson(await safetyDownload)
  expect(safety.storage['ak-clients-v1']).toBe('[]')
  await navigation

  expect(await rawSnapshot(page)).toEqual(target)
  const ledger = JSON.parse(target['ak-payments-ledger-v1'])
  expect(ledger.movements.map((movement) => movement.type)).toEqual(['payment', 'reversal'])
  expect(JSON.parse(target['ak-followups-v1'])['quote-backup'].reviewReceived).toBe(true)
})

test('identifica contenido interno dañado y lo restaura literalmente tras confirmación', async ({ page }) => {
  const target = baseStorage()
  const damaged = '{promoción-interna-dañada'
  target['ak-promotions-v1'] = damaged
  await seedStorage(page, baseStorage())
  await openSettings(page)
  await chooseBackup(page, makeBackup(target))

  await expect(page.locator('[data-restore-preview]')).toContainText('dañada o incompatible; se conservará literalmente')
  await page.locator('[data-restore-confirm]').check()
  const safetyDownload = page.waitForEvent('download')
  const navigation = page.waitForNavigation({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Restaurar las seis claves' }).click()
  await safetyDownload
  await navigation
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('ak-promotions-v1'))).toBe(damaged)
})

test('un fallo de escritura revierte las seis claves sin restauración parcial', async ({ page }) => {
  const current = baseStorage()
  const target = baseStorage()
  target['ak-settings-v1'] = JSON.stringify({ hourlyRate: 999 })
  target['ak-clients-v1'] = '[]'
  await seedStorage(page, current)
  await openSettings(page)
  await chooseBackup(page, makeBackup(target))
  await page.locator('[data-restore-confirm]').check()

  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    let failed = false
    Storage.prototype.setItem = function (key, value) {
      if (key === 'ak-clients-v1' && !failed) {
        failed = true
        throw new DOMException('Fallo simulado', 'QuotaExceededError')
      }
      return original.call(this, key, value)
    }
  })

  const safetyDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Restaurar las seis claves' }).click()
  await safetyDownload
  await expect(page.locator('[data-restore-status]')).toHaveText('No se pudo restaurar. Se recuperó el estado anterior.')
  expect(await rawSnapshot(page)).toEqual(current)
})

test('followup-phone-fix conserva byte por byte un seguimiento corrupto y bloquea la acción', async ({ page }) => {
  const corruptFollowup = '{seguimiento-corrupto-byte-por-byte'
  const storage = baseStorage()
  storage['ak-followups-v1'] = corruptFollowup
  await seedStorage(page, storage)
  let popupOpened = false
  page.on('popup', () => { popupOpened = true })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Pedidos/ }).click()
  const card = page.locator('.order-card').filter({ hasText: 'Pedido respaldo' })
  await expect(card.getByRole('heading', { name: 'Seguimiento después de la entrega' })).toBeVisible()
  await expect(card.locator('.ak-followup-panel [role="alert"]')).toContainText('seguimientos guardados necesitan revisión')
  await card.getByRole('button', { name: 'Abrir en WhatsApp' }).click()
  await expect(card.locator('[data-followup-status]')).toContainText('seguimientos guardados necesitan revisión')
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('ak-followups-v1'))).toBe(corruptFollowup)
  expect(popupOpened).toBe(false)
})
