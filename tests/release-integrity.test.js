const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(ROOT, file))
const stripQuery = (value) => value.split('?')[0].replace(/^\.\//, '')

const index = read('index.html')
const sw = read('sw.js')
const productionReset = read('production-data-reset.js')
const manifest = JSON.parse(read('manifest.webmanifest'))
const publishWorkflow = read('.github/workflows/publicar-sitio.yml')
const validationWorkflow = read('.github/workflows/validar-v2.yml')

const referencedAssets = [...index.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map((match) => match[1])
assert.ok(referencedAssets.length > 0, 'index.html debe contener recursos locales')

for (const asset of referencedAssets) {
  const file = stripQuery(asset)
  assert.ok(exists(file), `Falta el recurso referenciado por index.html: ${asset}`)
}

const shellMatch = sw.match(/const APP_SHELL = \[([\s\S]*?)\];/)
assert.ok(shellMatch, 'sw.js debe declarar APP_SHELL')
const appShell = [...shellMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1])
const shellSet = new Set(appShell)

for (const asset of appShell) {
  if (asset === './') continue
  const file = stripQuery(asset)
  assert.ok(exists(file), `APP_SHELL referencia un archivo inexistente: ${asset}`)
}

for (const asset of referencedAssets) {
  assert.ok(shellSet.has(asset), `El recurso de index.html no está precacheado en APP_SHELL: ${asset}`)
}

const requiredFinancialAssets = [
  './payments.js',
  './production-data-reset.js?v=2',
  './payments-storage.js',
  './payments-ui.js',
  './payments-ui.css',
  './home-finance-summary.js?v=32',
  './finance-example-exclusion.js?v=2',
  './workflow-fix.js',
  './order-integrity.js',
]
for (const asset of requiredFinancialAssets) {
  assert.ok(shellSet.has(asset), `Falta módulo financiero o de integridad en APP_SHELL: ${asset}`)
}

assert.ok(index.indexOf('./production-data-reset.js?v=2') < index.indexOf('./payments-storage.js'), 'El reinicio de datos debe ejecutarse antes de inicializar el ledger')
assert.match(productionReset, /joseluiscanaanl-max\.github\.io/, 'El reinicio automático debe cubrir GitHub Pages')
assert.match(productionReset, /el-arte-de-ana-karen\.vercel\.app/, 'El reinicio automático debe cubrir el dominio público de Vercel')
assert.match(productionReset, /preserved:\s*\['ak-settings-v1'\]/, 'El reinicio debe preservar la configuración del taller')
assert.match(productionReset, /ak-production-data-reset-v2-0-6/, 'El reinicio debe ser único y versionado')

assert.ok(!appShell.some((asset) => asset.includes('joce-canvas-sizes-stable.js')), 'APP_SHELL no debe incluir joce-canvas-sizes-stable.js obsoleto')
assert.match(sw, /const CACHE_PREFIX = ['"]ana-karen-['"];?/, 'La caché debe usar el prefijo propio ana-karen-')
assert.match(sw, /const CACHE_NAME = ['"]ana-karen-v29['"];?/, 'La caché esperada para esta release es ana-karen-v29')
assert.match(sw, /event\.waitUntil\([\s\S]*cache\.put\(/, 'Las escrituras dinámicas de caché deben quedar ligadas a event.waitUntil')

assert.equal(manifest.name, 'El Arte de Ana Karen')
assert.equal(manifest.id, './', 'El manifest debe tener un id estable para la PWA')
assert.equal(manifest.start_url, './')
assert.equal(manifest.scope, './', 'El scope de la PWA debe quedar limitado a la aplicación')
assert.equal(manifest.display, 'standalone')
assert.equal(manifest.lang, 'es-MX')
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest.webmanifest debe declarar iconos')
assert.ok(manifest.icons.some((icon) => String(icon.purpose || '').split(/\s+/).includes('any')), 'El manifest debe ofrecer al menos un icono usable como any')

assert.match(index, /name="apple-mobile-web-app-capable"\s+content="yes"/, 'index.html debe conservar compatibilidad de modo web app en iPhone/iPad')
assert.match(index, /name="apple-mobile-web-app-title"\s+content="El Arte de Ana Karen"/, 'index.html debe declarar el nombre de la app para iPhone/iPad')
assert.match(index, /viewport-fit=cover/, 'La interfaz debe respetar áreas seguras de pantallas móviles')

assert.match(publishWorkflow, /push:\s*\n\s*branches:\s*\n\s*- main\b/m, 'La publicación automática debe dispararse desde main')
assert.doesNotMatch(publishWorkflow, /-\s*v2(?:-|\b)/, 'El workflow de publicación no debe publicar ramas V2')
assert.match(publishWorkflow, /\n\s{2}validar:\s*\n/, 'La publicación debe incluir un job previo de validación')
assert.match(publishWorkflow, /\n\s{2}deploy:\s*\n[\s\S]*?needs:\s*validar\b/, 'El deploy debe depender del job validar')
assert.match(publishWorkflow, /npm run check/, 'La publicación debe validar sintaxis antes de desplegar')
assert.match(publishWorkflow, /npm run test:release/, 'La publicación debe validar integridad de release antes de desplegar')
assert.match(publishWorkflow, /npm run test:e2e/, 'La publicación debe ejecutar Playwright antes de desplegar')
assert.match(publishWorkflow, /chromium webkit/, 'La publicación debe validar navegadores Chromium y WebKit antes de desplegar')

assert.match(validationWorkflow, /- v2-desarrollo\b/, 'La validación automática debe cubrir v2-desarrollo')
assert.match(validationWorkflow, /'v2-\*'/, 'La validación automática debe cubrir ramas temporales v2-*')
assert.match(validationWorkflow, /chromium webkit/, 'La validación V2 debe instalar Chromium y WebKit')

console.log(`Release integrity passed: ${referencedAssets.length} recursos de index y ${appShell.length} recursos precacheados verificados.`)
