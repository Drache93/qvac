import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = await realpath(
  resolve(dirname(fileURLToPath(import.meta.url)), '..')
)
const port = Number(process.env.PORT ?? 8787)
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.gguf': 'application/octet-stream'
}

function parseRange(value, size) {
  const match = value?.match(/^bytes=(\d+)-(\d*)$/)
  if (!match) return
  const start = Number(match[1])
  const requestedEnd = match[2] ? Number(match[2]) : size - 1
  if (!Number.isSafeInteger(start) || start >= size)
    return { unsatisfied: true }
  return { start, end: Math.min(requestedEnd, size - 1) }
}

async function handleRequest(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed')
    return
  }
  const url = new URL(request.url, 'http://localhost')
  if (url.pathname === '/') {
    response.writeHead(302, { Location: './demo/' }).end()
    return
  }
  let pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    response.writeHead(400).end('Invalid URL')
    return
  }
  const candidate = resolve(
    packageRoot,
    `.${pathname}`,
    pathname.endsWith('/') ? 'index.html' : ''
  )
  if (!candidate.startsWith(packageRoot + sep)) {
    response.writeHead(403).end('Forbidden')
    return
  }
  try {
    const path = await realpath(candidate)
    if (!path.startsWith(packageRoot + sep)) {
      response.writeHead(403).end('Forbidden')
      return
    }
    const metadata = await stat(path)
    if (!metadata.isFile()) {
      response.writeHead(404).end('Not found')
      return
    }
    const range = parseRange(request.headers.range, metadata.size)
    if (range?.unsatisfied) {
      response
        .writeHead(416, {
          'Content-Range': `bytes */${metadata.size}`,
          'Accept-Ranges': 'bytes'
        })
        .end()
      return
    }
    const status = range ? 206 : 200
    const length = range ? range.end - range.start + 1 : metadata.size
    response.writeHead(status, {
      'Content-Type': mimeTypes[extname(path)] ?? 'application/octet-stream',
      'Content-Length': length,
      'Accept-Ranges': 'bytes',
      ...(range && {
        'Content-Range': `bytes ${range.start}-${range.end}/${metadata.size}`
      }),
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    })
    if (request.method === 'HEAD') {
      response.end()
      return
    }
    const stream = createReadStream(
      path,
      range ? { start: range.start, end: range.end } : undefined
    )
    stream.on('error', function () {
      response.destroy()
    })
    response.on('close', function () {
      stream.destroy()
    })
    stream.pipe(response)
  } catch (error) {
    response
      .writeHead(
        error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500
      )
      .end('File unavailable')
  }
}

const server = createServer(function (request, response) {
  handleRequest(request, response).catch(function (error) {
    console.error(error)
    response.destroy()
  })
})
server.listen(port, '127.0.0.1', function () {
  console.log(
    `QVAC browser demo: http://127.0.0.1:${server.address().port}/demo/`
  )
})
