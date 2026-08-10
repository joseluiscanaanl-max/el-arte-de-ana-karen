const CACHE_PREFIX = 'ana-karen-';
const CACHE_NAME = 'ana-karen-v27';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './styles.css',
  './layout-fix.css',
  './joce-layout-safe.css?v=23',
  './payments-ui.css',
  './pricing.js',
  './payments.js',
  './payments-storage.js',
  './settings-persistence.js?v=1',
  './app.js',
  './quote-share-message.js?v=34',
  './workflow-status-guard.js',
  './workflow-fix.js',
  './payments-ui.js',
  './order-integrity.js',
  './followup.js',
  './followup-phone-fix.js',
  './home-finance-summary.js?v=32',
  './finance-example-exclusion.js?v=1',
  './joce-photo-analysis.js?v=20',
  './joce-canvas-fit.js?v=24',
  './joce-acrylic-preview.js?v=42',
  './joce-acrylic-share.js?v=26',
  './joce-acrylic-estimates.js?v=27',
  './joce-canvas-catalog.js?v=28',
  './joce-approved-fixed-layout.js?v=31',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((response) => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })
  );
});
