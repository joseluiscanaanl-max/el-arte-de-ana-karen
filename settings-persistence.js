(() => {
  'use strict'

  const SETTINGS_KEY = 'ak-settings-v1'
  const DEFAULT_SETTINGS = Object.freeze({
    hourlyRate: 150,
    marginPercent: 35,
    depositPercent: 50,
    indirectPercent: 10,
  })

  const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

  const ensurePersistentSettings = () => {
    const raw = localStorage.getItem(SETTINGS_KEY)

    if (raw === null) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS))
      return
    }

    try {
      const parsed = JSON.parse(raw)
      if (!isPlainObject(parsed)) return

      const merged = { ...DEFAULT_SETTINGS, ...parsed }
      const serialized = JSON.stringify(merged)
      if (serialized !== raw) localStorage.setItem(SETTINGS_KEY, serialized)
    } catch {
      // No se reemplaza contenido dañado; app.js lo detecta y protege el dato original.
    }
  }

  ensurePersistentSettings()
  window.addEventListener('pageshow', ensurePersistentSettings)
})()
