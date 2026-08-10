const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..')
const SKIP_DIRS = new Set(['.git', 'node_modules', 'playwright-report', 'test-results'])
const EXTENSIONS = new Set(['.js', '.cjs'])

const files = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath)
      continue
    }
    if (EXTENSIONS.has(path.extname(entry.name))) files.push(fullPath)
  }
}

walk(ROOT)
files.sort()

let failed = false
for (const file of files) {
  const relative = path.relative(ROOT, file)
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status !== 0) {
    failed = true
    console.error(`\nERROR de sintaxis: ${relative}`)
    if (result.stdout) console.error(result.stdout.trim())
    if (result.stderr) console.error(result.stderr.trim())
  }
}

if (failed) process.exit(1)
console.log(`Syntax check passed: ${files.length} archivos JavaScript.`)
