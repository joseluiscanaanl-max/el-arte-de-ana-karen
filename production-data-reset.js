(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else {
    root.AKProductionDataReset = api
    if (root.localStorage) api.autoReset(root.localStorage, root.sessionStorage, root.location)
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  const RESET_MARKER = 'ak-production-data-reset-v2-0-6'
  const PRODUCTION_LOCATIONS = Object.freeze([
    Object.freeze({ hostname: 'joseluiscanaanl-max.github.io', pathPrefix: '/el-arte-de-ana-karen/' }),
    Object.freeze({ hostname: 'el-arte-de-ana-karen.vercel.app', pathPrefix: '/' }),
  ])
  const OPERATIONAL_KEYS = [
    'ak-clients-v1',
    'ak-quotes-v1',
    'ak-promotions-v1',
    'ak-followups-v1',
    'ak-payments-ledger-v1',
  ]
  const TEMPORARY_SESSION_KEYS = ['ak-joce-reference-v1']

  const isProductionLocation = (location) => Boolean(
    location
    && PRODUCTION_LOCATIONS.some(({ hostname, pathPrefix }) => (
      location.hostname === hostname
      && String(location.pathname || '/').startsWith(pathPrefix)
    ))
  )

  const restoreSnapshot = (storage, snapshot) => {
    Object.entries(snapshot).forEach(([key, value]) => {
      if (value === null) storage.removeItem(key)
      else storage.setItem(key, value)
    })
  }

  const resetOperationalData = (storage, sessionStorage, options = {}) => {
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
      throw new TypeError('storage debe implementar getItem, setItem y removeItem')
    }

    const existingMarker = storage.getItem(RESET_MARKER)
    if (existingMarker !== null) {
      return { reset: false, reason: 'already-reset', marker: existingMarker }
    }

    const resetAt = options.resetAt || new Date().toISOString()
    const snapshot = Object.fromEntries([...OPERATIONAL_KEYS, RESET_MARKER].map((key) => [key, storage.getItem(key)]))
    const sessionSnapshot = sessionStorage && typeof sessionStorage.getItem === 'function'
      ? Object.fromEntries(TEMPORARY_SESSION_KEYS.map((key) => [key, sessionStorage.getItem(key)]))
      : null

    try {
      OPERATIONAL_KEYS.forEach((key) => storage.removeItem(key))
      if (sessionStorage && typeof sessionStorage.removeItem === 'function') {
        TEMPORARY_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key))
      }
      const marker = JSON.stringify({
        version: 1,
        resetAt,
        scope: 'operational-data',
        preserved: ['ak-settings-v1'],
        cleared: OPERATIONAL_KEYS,
      })
      storage.setItem(RESET_MARKER, marker)
      return { reset: true, reason: 'completed', marker }
    } catch (error) {
      try {
        restoreSnapshot(storage, snapshot)
        if (sessionSnapshot && sessionStorage) restoreSnapshot(sessionStorage, sessionSnapshot)
      } catch {}
      return { reset: false, reason: 'rollback', error: error.message }
    }
  }

  const autoReset = (storage, sessionStorage, location) => {
    if (!isProductionLocation(location)) return { reset: false, reason: 'not-production' }
    return resetOperationalData(storage, sessionStorage)
  }

  return {
    RESET_MARKER,
    PRODUCTION_LOCATIONS,
    OPERATIONAL_KEYS,
    isProductionLocation,
    resetOperationalData,
    autoReset,
  }
})
