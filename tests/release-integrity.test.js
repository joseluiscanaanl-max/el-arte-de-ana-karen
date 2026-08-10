const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(ROOT, file))
const stripQuery = (value) => value.split('?')[0].replace(/^\.\//, '')

const index = read('index.html')
const sw = read('sw.js')
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
  './payments-storage.js',
  './payments-ui.js',
  './payments-ui.css',
  './home-finance-summary.js',
  './workflow-fix.js',
]
for (const asset of requiredFinancialAssets) {
  assert.ok(shellSet.has(asset), `Falta módulo financiero en APP_SHELL: ${asset}`)
}

assert.ok(!appShell.some((asset) => asset.includes('joce-canvas-sizes-stable.js')), 'APP_SHELL no debe incluir joce-canvas-sizes-stable.js obsoleto')
assert.match(sw, /const CACHE_PREFIX = ['"]ana-karen-['"];?/, 'La caché debe usar el prefijo propio ana-karen-')
assert.match(sw, /const CACHE_NAME = ['"]ana-karen-v24['"];?/, 'La caché esperada para esta release es ana-karen-v24')
assert.match(sw, /event\.waitUntil\([\s\S]*cache\.put\(/, 'Las escrituras dinámicas de caché deben quedar ligadas a event.waitUntil')

assert.equal(manifest.name, 'El Arte de Ana Karen')
assert.equal(manifest.display, 'standalone')
assert.equal(manifest.lang, 'es-MX')
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest.webmanifest debe declarar iconos')

assert.match(publishWorkflow, /push:\s*\n\s*branches:\s*\n\s*- main\b/m, 'La publicación automática debe dispararse desde main')
assert.doesNotMatch(publishWorkflow, /-\s*v2(?:-|\b)/, 'El workflow de publicación no debe publicar ramas V2')
assert.match(validationWorkflow, /- v2-desarrollo\b/, 'La validación automática debe cubrir v2-desarrollo')
assert.match(validationWorkflow, /'v2-\*'/, 'La validación automática debe cubrir ramas temporales v2-*')

console.log(`Release integrity passed: ${referencedAssets.length} recursos de index y ${appShell.length} recursos precacheados verificados.`)
