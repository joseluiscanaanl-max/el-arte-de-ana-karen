const http = require('node:http')
const path = require('node:path')
const fs = require('node:fs')

const host = '127.0.0.1'
const port = 4173
const root = path.resolve(__dirname, '../..')

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`)
  const relativePath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
  const filePath = path.resolve(root, `.${relativePath}`)

  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404)
      response.end('Not found')
      return
    }

    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    })
    fs.createReadStream(filePath).pipe(response)
  })
})

module.exports = async () => {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, resolve)
  })

  return async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
}
