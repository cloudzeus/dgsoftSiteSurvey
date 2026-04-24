'use strict'
/**
 * Production static-file proxy.
 *
 * Runs on $PORT (default 3000). Serves /_next/static/* and public/* directly
 * from the local filesystem; proxies everything else to Next.js on $NEXT_PORT
 * (default 3001). This bypasses the bug in Next.js standalone mode where
 * nextStaticFolderItems is silently left empty when the directory scan fails,
 * causing 404 for every stylesheet and JS chunk.
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = parseInt(process.env.PORT || '3000', 10)
const NEXT_PORT = parseInt(process.env.NEXT_PORT || '3001', 10)
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0'

const STATIC_DIR = path.join(__dirname, '.next', 'static')
const PUBLIC_DIR = path.join(__dirname, 'public')

const MIME = {
  '.js':    'application/javascript; charset=utf-8',
  '.cjs':   'application/javascript; charset=utf-8',
  '.mjs':   'application/javascript; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.html':  'text/html; charset=utf-8',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.ico':   'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.otf':   'font/otf',
  '.eot':   'application/vnd.ms-fontobject',
  '.webp':  'image/webp',
  '.avif':  'image/avif',
  '.txt':   'text/plain; charset=utf-8',
  '.xml':   'application/xml; charset=utf-8',
  '.map':   'application/json; charset=utf-8',
}

/** Serve a file if it exists. Returns true on success. */
function serveFile(req, res, filePath, immutable) {
  let stat
  try { stat = fs.statSync(filePath) } catch { return false }
  if (!stat.isFile()) return false

  const ext = path.extname(filePath).toLowerCase()
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': immutable
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=0, must-revalidate',
  }
  res.writeHead(200, headers)
  // HEAD requests must not send a body
  if (req.method === 'HEAD') { res.end(); return true }
  fs.createReadStream(filePath).pipe(res)
  return true
}

/** Forward the request to the Next.js server. */
function proxyToNext(req, res) {
  const options = {
    hostname: '127.0.0.1',
    port: NEXT_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  }
  const pr = http.request(options, (nr) => {
    res.writeHead(nr.statusCode, nr.headers)
    nr.pipe(res, { end: true })
  })
  pr.on('error', () => {
    if (!res.headersSent) res.writeHead(502)
    res.end('Bad Gateway')
  })
  req.pipe(pr, { end: true })
}

const server = http.createServer((req, res) => {
  const rawUrl = req.url || '/'
  const urlPath = rawUrl.split('?')[0]

  // /_next/static/* — immutably cacheable build artifacts
  if (urlPath.startsWith('/_next/static/')) {
    const rel = decodeURIComponent(urlPath.slice('/_next/static/'.length))
    if (serveFile(req, res, path.join(STATIC_DIR, rel), true)) return
  }

  // Public directory files (favicon, robots.txt, etc.)
  if (!urlPath.startsWith('/_next/') && !urlPath.startsWith('/api/')) {
    const rel = urlPath === '/' ? '' : decodeURIComponent(urlPath)
    if (rel && serveFile(req, res, path.join(PUBLIC_DIR, rel), false)) return
  }

  proxyToNext(req, res)
})

server.listen(PORT, HOSTNAME, () => {
  console.log(`[proxy] listening :${PORT}  →  Next.js :${NEXT_PORT}`)
  console.log(`[proxy] static dir: ${STATIC_DIR}`)
  console.log(`[proxy] public dir: ${PUBLIC_DIR}`)
})
