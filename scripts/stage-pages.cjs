'use strict'

const fs = require('node:fs')
const path = require('node:path')

const ROOT = process.cwd()
const OUTPUT = path.join(ROOT, '_site')
const ENTRY = 'index.html'
const FORBIDDEN_TOP_LEVEL = new Set([
  '.git',
  '.github',
  'tests',
  'scripts',
  'node_modules',
  'playwright-report',
  'test-results',
])
const FORBIDDEN_FILES = new Set([
  'package.json',
  'package-lock.json',
  'README.md',
  'VALIDACION.md',
])

const normalizeLocalReference = (raw, baseDir = '.') => {
  if (!raw || /^(?:[a-z]+:|\/\/|#|data:|mailto:|tel:)/i.test(raw)) return null

  const clean = raw.split('#')[0].split('?')[0]
  if (!clean) return null

  const withoutPrefix = clean.replace(/^\.\//, '')
  const relative = path.posix.normalize(path.posix.join(baseDir.replaceAll('\\', '/'), withoutPrefix))

  if (
    relative === '.' ||
    relative.startsWith('../') ||
    path.posix.isAbsolute(relative) ||
    relative.includes('/../')
  ) {
    throw new Error(`Referencia pública insegura: ${raw}`)
  }

  const topLevel = relative.split('/')[0]
  if (FORBIDDEN_TOP_LEVEL.has(topLevel) || FORBIDDEN_FILES.has(relative)) {
    throw new Error(`El artefacto público intenta incluir contenido privado: ${relative}`)
  }

  return relative
}

const addReference = (files, raw, baseDir) => {
  const normalized = normalizeLocalReference(raw, baseDir)
  if (normalized) files.add(normalized)
}

const collectHtmlReferences = (files, html) => {
  const attributePattern = /(?:src|href)=["']([^"']+)["']/gi
  for (const match of html.matchAll(attributePattern)) addReference(files, match[1], '.')
}

const collectManifestReferences = (files, manifestPath) => {
  if (!files.has(manifestPath)) return
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, manifestPath), 'utf8'))
  const baseDir = path.posix.dirname(manifestPath)
  for (const icon of manifest.icons || []) addReference(files, icon?.src, baseDir)
  for (const screenshot of manifest.screenshots || []) addReference(files, screenshot?.src, baseDir)
}

const collectCssReferences = (files) => {
  let changed = true
  while (changed) {
    changed = false
    for (const relative of [...files]) {
      if (!relative.endsWith('.css')) continue
      const absolute = path.join(ROOT, relative)
      const css = fs.readFileSync(absolute, 'utf8')
      const baseDir = path.posix.dirname(relative)
      const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi
      for (const match of css.matchAll(urlPattern)) {
        const normalized = normalizeLocalReference(match[1], baseDir)
        if (normalized && !files.has(normalized)) {
          files.add(normalized)
          changed = true
        }
      }
    }
  }
}

const assertRegularFile = (relative) => {
  const absolute = path.join(ROOT, relative)
  if (!fs.existsSync(absolute)) throw new Error(`Falta recurso público referenciado: ${relative}`)
  const stat = fs.lstatSync(absolute)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Recurso público no permitido (debe ser archivo regular): ${relative}`)
  }
}

const copyPublicFile = (relative) => {
  assertRegularFile(relative)
  const destination = path.join(OUTPUT, relative)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.copyFileSync(path.join(ROOT, relative), destination)
}

const assertBundleBoundary = (files) => {
  for (const relative of files) {
    const topLevel = relative.split('/')[0]
    if (FORBIDDEN_TOP_LEVEL.has(topLevel) || FORBIDDEN_FILES.has(relative)) {
      throw new Error(`Límite de publicación violado por: ${relative}`)
    }
  }
}

const main = () => {
  const entryPath = path.join(ROOT, ENTRY)
  if (!fs.existsSync(entryPath)) throw new Error(`No existe ${ENTRY}`)

  const files = new Set([ENTRY])
  const html = fs.readFileSync(entryPath, 'utf8')
  collectHtmlReferences(files, html)

  const manifestPath = [...files].find((item) => item.endsWith('.webmanifest'))
  if (manifestPath) collectManifestReferences(files, manifestPath)
  collectCssReferences(files)
  assertBundleBoundary(files)

  fs.rmSync(OUTPUT, { recursive: true, force: true })
  fs.mkdirSync(OUTPUT, { recursive: true })

  for (const relative of [...files].sort()) copyPublicFile(relative)

  const published = [...files].sort()
  console.log(`Pages bundle seguro: ${published.length} archivos públicos explícitos.`)
  for (const relative of published) console.log(`  - ${relative}`)
}

main()
