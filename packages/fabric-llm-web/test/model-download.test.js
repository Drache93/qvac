import test from 'node:test'
import assert from 'node:assert/strict'
import { downloadModelToCache } from '../src/model-download.js'

function memoryStorage(initial = []) {
  let bytes = Uint8Array.from(initial)
  const fileHandle = {
    async getFile() {
      return new Blob([bytes])
    },
    async createWritable() {
      let cursor = 0
      return {
        async seek(position) {
          cursor = position
        },
        async truncate(size) {
          bytes = bytes.slice(0, size)
          cursor = Math.min(cursor, size)
        },
        async write(value) {
          const next = new Uint8Array(
            Math.max(bytes.length, cursor + value.length)
          )
          next.set(bytes)
          next.set(value, cursor)
          bytes = next
          cursor += value.length
        },
        async close() {},
        async abort() {}
      }
    }
  }
  return {
    async getDirectory() {
      return {
        async getDirectoryHandle() {
          return {
            async getFileHandle() {
              return fileHandle
            }
          }
        }
      }
    }
  }
}

function syncMemoryStorage() {
  const files = new Map()
  function fileHandle(name) {
    if (!files.has(name)) files.set(name, new Uint8Array())
    return {
      async getFile() {
        return new Blob([files.get(name)])
      },
      async createSyncAccessHandle() {
        return {
          getSize() {
            return files.get(name).length
          },
          read(target, { at }) {
            const source = files.get(name).subarray(at, at + target.length)
            target.set(source)
            return source.length
          },
          write(source, { at }) {
            const current = files.get(name)
            const next = new Uint8Array(
              Math.max(current.length, at + source.length)
            )
            next.set(current)
            next.set(source, at)
            files.set(name, next)
            return source.length
          },
          truncate(size) {
            files.set(name, files.get(name).slice(0, size))
          },
          flush() {},
          close() {}
        }
      }
    }
  }
  return {
    async getDirectory() {
      return {
        async getDirectoryHandle() {
          return {
            async getFileHandle(name) {
              return fileHandle(name)
            }
          }
        }
      }
    }
  }
}

function interruptedResponse() {
  let sent = false
  return new Response(
    new ReadableStream({
      pull(controller) {
        if (!sent) {
          sent = true
          controller.enqueue(Uint8Array.from([1, 2, 3]))
        } else controller.error(new Error('network dropped'))
      }
    }),
    { headers: { 'content-length': '6' } }
  )
}

test('persists a partial response and resumes it with Range', async function () {
  const storage = memoryStorage()
  const ranges = []
  let gets = 0
  const progress = []
  const file = await downloadModelToCache({
    url: 'https://example.com/model.gguf',
    storage,
    wait: async function () {},
    onProgress(value) {
      progress.push(value)
    },
    async fetchModel(_url, options = {}) {
      if (options.method === 'HEAD')
        return new Response(null, { headers: { 'content-length': '6' } })
      ranges.push(options.headers?.Range)
      gets++
      if (gets === 1) return interruptedResponse()
      return new Response(Uint8Array.from([4, 5, 6]), {
        status: 206,
        headers: {
          'content-length': '3',
          'content-range': 'bytes 3-5/6'
        }
      })
    }
  })
  assert.deepEqual(ranges, ['bytes=0-', 'bytes=3-'])
  assert.deepEqual(
    [...new Uint8Array(await file.arrayBuffer())],
    [1, 2, 3, 4, 5, 6]
  )
  assert.equal(progress.at(-1).percentage, 100)
  assert.equal(progress.at(-1).resumed, true)
})

test('resumes a durable checkpoint in a new downloader session', async function () {
  const storage = syncMemoryStorage()
  const url = 'https://example.com/durable.gguf'
  await assert.rejects(
    downloadModelToCache({
      url,
      storage,
      maxRetries: 0,
      async fetchModel(_url, options = {}) {
        if (options.method === 'HEAD')
          return new Response(null, {
            headers: { 'content-length': '6', etag: '"v1"' }
          })
        return new Response(interruptedResponse().body, {
          status: 206,
          headers: {
            'content-length': '6',
            'content-range': 'bytes 0-5/6',
            etag: '"v1"'
          }
        })
      }
    }),
    /network dropped/
  )

  let requestedRange
  const file = await downloadModelToCache({
    url,
    storage,
    async fetchModel(_url, options = {}) {
      if (options.method === 'HEAD')
        return new Response(null, {
          headers: { 'content-length': '6', etag: '"v1"' }
        })
      requestedRange = options.headers.Range
      return new Response(Uint8Array.from([4, 5, 6]), {
        status: 206,
        headers: {
          'content-length': '3',
          'content-range': 'bytes 3-5/6',
          etag: '"v1"'
        }
      })
    }
  })
  assert.equal(requestedRange, 'bytes=3-')
  assert.deepEqual(
    [...new Uint8Array(await file.arrayBuffer())],
    [1, 2, 3, 4, 5, 6]
  )
})

test('reuses a complete persistent download without another GET', async function () {
  const storage = memoryStorage([1, 2, 3])
  let gets = 0
  const progress = []
  const file = await downloadModelToCache({
    url: 'https://example.com/model.gguf',
    storage,
    onProgress(value) {
      progress.push(value)
    },
    async fetchModel(_url, options = {}) {
      if (options.method === 'HEAD')
        return new Response(null, { headers: { 'content-length': '3' } })
      gets++
      throw new Error('GET must not run for a complete cache entry')
    }
  })
  assert.equal(file.size, 3)
  assert.equal(gets, 0)
  assert.equal(progress.at(-1).cacheHit, true)
})

test('restarts instead of appending when a server ignores Range', async function () {
  const file = await downloadModelToCache({
    url: 'https://example.com/model.gguf',
    storage: memoryStorage([9, 9, 9]),
    async fetchModel(_url, options = {}) {
      if (options.method === 'HEAD')
        return new Response(null, { headers: { 'content-length': '6' } })
      assert.equal(options.headers.Range, 'bytes=3-')
      return new Response(Uint8Array.from([1, 2, 3, 4, 5, 6]), {
        headers: { 'content-length': '6' }
      })
    }
  })
  assert.deepEqual(
    [...new Uint8Array(await file.arrayBuffer())],
    [1, 2, 3, 4, 5, 6]
  )
})

test('rejects a resumed response with the wrong Content-Range start', async function () {
  await assert.rejects(
    downloadModelToCache({
      url: 'https://example.com/model.gguf',
      storage: memoryStorage([1, 2, 3]),
      maxRetries: 0,
      async fetchModel(_url, options = {}) {
        if (options.method === 'HEAD')
          return new Response(null, { headers: { 'content-length': '6' } })
        return new Response(Uint8Array.from([4, 5, 6]), {
          status: 206,
          headers: {
            'content-length': '3',
            'content-range': 'bytes 2-4/6'
          }
        })
      }
    }),
    /Invalid Content-Range/
  )
})

test('does not retry a terminal HTTP failure', async function () {
  let gets = 0
  await assert.rejects(
    downloadModelToCache({
      url: 'https://example.com/missing.gguf',
      storage: memoryStorage(),
      wait: async function () {},
      async fetchModel(_url, options = {}) {
        if (options.method === 'HEAD')
          return new Response(null, { status: 404 })
        gets++
        return new Response(null, { status: 404 })
      }
    }),
    /HTTP 404/
  )
  assert.equal(gets, 1)
})
