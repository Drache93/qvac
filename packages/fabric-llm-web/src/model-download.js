const DEFAULT_MAX_RETRIES = 5
const RETRY_BASE_DELAY_MS = 500
const CHECKPOINT_BYTES = 8 * 1024 * 1024
const STREAM_STALL_TIMEOUT_MS = 10_000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function createDownloadError(message, retryable = false) {
  const error = new Error(message)
  error.retryable = retryable
  return error
}

async function readChunk(reader) {
  let timer
  try {
    return await Promise.race([
      reader.read(),
      new Promise(function (_resolve, reject) {
        timer = setTimeout(function () {
          reject(
            createDownloadError(
              `Model download stalled for ${STREAM_STALL_TIMEOUT_MS}ms`,
              true
            )
          )
        }, STREAM_STALL_TIMEOUT_MS)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

function parseContentRange(value) {
  let match = value?.match(/^bytes (\d+)-(\d+)\/(\d+)$/)
  if (match)
    return {
      start: Number(match[1]),
      end: Number(match[2]),
      total: Number(match[3])
    }
  match = value?.match(/^bytes \*\/(\d+)$/)
  return match ? { total: Number(match[1]), unsatisfied: true } : undefined
}

async function modelCacheKey(url) {
  const bytes = new TextEncoder().encode(url)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map(function (byte) {
      return byte.toString(16).padStart(2, '0')
    })
    .join('')
}

function responseValidator(headers) {
  const etag = headers.get('etag') ?? headers.get('x-linked-etag')
  if (etag && !etag.startsWith('W/')) return etag
  return headers.get('last-modified') ?? undefined
}

async function remoteInfo(url, fetchModel) {
  try {
    const response = await fetchModel(url, { method: 'HEAD' })
    if (!response.ok) return {}
    return {
      total: Number(
        response.headers.get('content-length') ??
          response.headers.get('x-linked-size') ??
          0
      ),
      validator: responseValidator(response.headers)
    }
  } catch {
    return {}
  }
}

async function openModelCache(storage, url) {
  if (!storage?.getDirectory) return
  const root = await storage.getDirectory()
  const directory = await root.getDirectoryHandle('qvac-models', {
    create: true
  })
  const key = await modelCacheKey(url)
  const fileHandle = await directory.getFileHandle(`${key}.gguf`, {
    create: true
  })
  return { directory, key, fileHandle }
}

function readMetadata(handle) {
  const size = handle.getSize()
  if (!size) return {}
  const bytes = new Uint8Array(size)
  handle.read(bytes, { at: 0 })
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return {}
  }
}

function writeMetadata(handle, value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  handle.truncate(0)
  let written = 0
  while (written < bytes.length) {
    const count = handle.write(bytes.subarray(written), { at: written })
    if (count <= 0) throw new Error('Unable to checkpoint model metadata')
    written += count
  }
  handle.flush()
}

async function createSyncCache(cache, url) {
  if (typeof cache.fileHandle.createSyncAccessHandle !== 'function') return
  const data = await cache.fileHandle.createSyncAccessHandle()
  const metadataFile = await cache.directory.getFileHandle(
    `${cache.key}.json`,
    { create: true }
  )
  const metadataHandle = await metadataFile.createSyncAccessHandle()
  let metadata = readMetadata(metadataHandle)
  let closed = false

  function checkpoint(offset, total, complete, remote) {
    data.flush()
    metadata = {
      url,
      committedOffset: offset,
      total,
      complete,
      validator: remote.validator
    }
    writeMetadata(metadataHandle, metadata)
  }
  function reset(remote) {
    data.truncate(0)
    checkpoint(0, remote.total ?? 0, false, remote)
  }
  function reconcile(remote) {
    const size = data.getSize()
    const sameSource = metadata.url === url
    const changedValidator =
      sameSource &&
      metadata.validator &&
      remote.validator &&
      metadata.validator !== remote.validator
    const changedTotal =
      sameSource &&
      metadata.total &&
      remote.total &&
      metadata.total !== remote.total
    if (!sameSource || changedValidator || changedTotal) {
      if (size && !metadata.url) {
        metadata = {
          url,
          committedOffset: size,
          total: remote.total ?? 0,
          complete: Boolean(remote.total && size === remote.total),
          validator: remote.validator
        }
        checkpoint(size, metadata.total, metadata.complete, remote)
      } else reset(remote)
    }
    const committed = Number(metadata.committedOffset) || 0
    if (data.getSize() < committed) reset(remote)
    else if (data.getSize() > committed) data.truncate(committed)
    return Number(metadata.committedOffset) || 0
  }
  async function writeResponse(response, start, total, remote, onProgress) {
    if (start === 0) reset(remote)
    const reader = response.body?.getReader()
    if (!reader)
      throw createDownloadError('Model response has no readable body')
    let downloaded = start
    let checkpointed = start
    try {
      while (true) {
        const { done, value } = await readChunk(reader)
        if (done) break
        let position = 0
        while (position < value.length) {
          const count = data.write(value.subarray(position), {
            at: downloaded + position
          })
          if (count <= 0) throw new Error('Unable to write model cache')
          position += count
        }
        downloaded += value.length
        if (downloaded - checkpointed >= CHECKPOINT_BYTES) {
          checkpoint(downloaded, total, false, remote)
          checkpointed = downloaded
        }
        onProgress({
          phase: 'download',
          downloaded,
          total,
          percentage: total ? (100 * downloaded) / total : 0,
          resumed: start > 0
        })
      }
      if (total && downloaded !== total) {
        checkpoint(downloaded, total, false, remote)
        throw createDownloadError(
          `Model download ended at ${downloaded} of ${total} bytes`,
          true
        )
      }
      checkpoint(downloaded, total, true, remote)
    } catch (error) {
      await reader.cancel().catch(function () {})
      checkpoint(downloaded, total, false, remote)
      throw createDownloadError(
        error instanceof Error ? error.message : String(error),
        true
      )
    }
    return downloaded
  }
  async function finish(offset, total, remote) {
    checkpoint(offset, total, true, remote)
    data.close()
    metadataHandle.close()
    closed = true
    return cache.fileHandle.getFile()
  }
  function close() {
    if (closed) return
    data.close()
    metadataHandle.close()
    closed = true
  }
  return {
    durable: true,
    reconcile,
    reset,
    size() {
      return data.getSize()
    },
    writeResponse,
    finish,
    close
  }
}

async function createAsyncCache(cache) {
  return {
    durable: false,
    async reconcile(remote) {
      const file = await cache.fileHandle.getFile()
      if (remote.total && file.size > remote.total) await this.reset()
      return (await cache.fileHandle.getFile()).size
    },
    async reset() {
      const writable = await cache.fileHandle.createWritable()
      await writable.truncate(0)
      await writable.close()
    },
    async size() {
      return (await cache.fileHandle.getFile()).size
    },
    async writeResponse(response, start, total, _remote, onProgress) {
      const writable = await cache.fileHandle.createWritable({
        keepExistingData: true
      })
      if (start === 0) await writable.truncate(0)
      await writable.seek(start)
      const reader = response.body?.getReader()
      if (!reader) {
        await writable.abort()
        throw createDownloadError('Model response has no readable body')
      }
      let downloaded = start
      try {
        while (true) {
          const { done, value } = await readChunk(reader)
          if (done) break
          await writable.write(value)
          downloaded += value.length
          onProgress({
            phase: 'download',
            downloaded,
            total,
            percentage: total ? (100 * downloaded) / total : 0,
            resumed: start > 0
          })
        }
        await writable.close()
      } catch (error) {
        await reader.cancel().catch(function () {})
        await writable.close().catch(function () {})
        throw createDownloadError(
          error instanceof Error ? error.message : String(error),
          true
        )
      }
      if (total && downloaded !== total)
        throw createDownloadError(
          `Model download ended at ${downloaded} of ${total} bytes`,
          true
        )
      return downloaded
    },
    async finish() {
      return cache.fileHandle.getFile()
    },
    close() {}
  }
}

async function performDownload({ url, cache, fetchModel, onProgress }) {
  const remote = await remoteInfo(url, fetchModel)
  let start = await cache.reconcile(remote)
  if (start && remote.total && start === remote.total) {
    onProgress({
      phase: 'download',
      downloaded: start,
      total: remote.total,
      percentage: 100,
      cacheHit: true
    })
    return cache.finish(start, remote.total, remote)
  }

  let response
  try {
    response = await fetchModel(url, {
      // Fetch adds Accept-Encoding: identity for a single Range request, so the
      // persisted offsets always refer to the transferred representation.
      headers: { Range: `bytes=${start}-` }
    })
  } catch (error) {
    throw createDownloadError(
      error instanceof Error ? error.message : String(error),
      true
    )
  }
  const contentEncoding = response.headers.get('content-encoding')
  if (contentEncoding && contentEncoding !== 'identity')
    throw createDownloadError(
      `Cannot safely resume a Content-Encoding ${contentEncoding} response`
    )
  const range = parseContentRange(response.headers.get('content-range'))
  if (
    response.status === 416 &&
    start &&
    range?.unsatisfied &&
    range.total === start &&
    (!remote.total || remote.total === start)
  )
    return cache.finish(start, start, remote)
  if (!response.ok) {
    throw createDownloadError(
      `Model download failed: HTTP ${response.status}`,
      response.status === 408 ||
        response.status === 429 ||
        response.status >= 500
    )
  }

  if (start && response.status !== 206) {
    await cache.reset(remote)
    start = 0
  }
  if (response.status === 206) {
    if (
      !range ||
      range.unsatisfied ||
      range.start !== start ||
      range.end < range.start
    )
      throw createDownloadError(
        'Invalid Content-Range for resumed model download'
      )
    const rangeLength = range.end - range.start + 1
    const contentLength = Number(response.headers.get('content-length')) || 0
    if (contentLength && contentLength !== rangeLength)
      throw createDownloadError(
        'Content-Length does not match resumed byte range'
      )
    if (remote.total && range.total !== remote.total) {
      await cache.reset(remote)
      throw createDownloadError('Model changed while resuming download', true)
    }
  }
  const length = Number(response.headers.get('content-length')) || 0
  const total = range?.total || (length ? start + length : (remote.total ?? 0))
  const downloaded = await cache.writeResponse(
    response,
    start,
    total,
    remote,
    onProgress
  )
  return cache.finish(downloaded, total || downloaded, remote)
}

export async function downloadModelToCache({
  url,
  fetchModel = fetch,
  storage = globalThis.navigator?.storage,
  onProgress = function () {},
  onLog = function () {},
  wait = sleep,
  maxRetries = DEFAULT_MAX_RETRIES
}) {
  const source = new URL(url)
  if (!['http:', 'https:'].includes(source.protocol))
    throw new Error('Model URL must use HTTP or HTTPS')
  const handles = await openModelCache(storage, source.href)
  if (!handles) return
  const cache =
    (await createSyncCache(handles, source.href)) ??
    (await createAsyncCache(handles))

  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return await performDownload({
          url: source.href,
          cache,
          fetchModel,
          onProgress
        })
      } catch (error) {
        if (!error.retryable) throw error
        if (attempt >= maxRetries) {
          throw new Error(
            `${error.message}. Partial download saved at ${await cache.size()} bytes; load again to resume.`
          )
        }
        onLog(
          `Model download interrupted; retrying from byte ${await cache.size()} ` +
            `(attempt ${attempt + 1}/${maxRetries})`
        )
        await wait(RETRY_BASE_DELAY_MS * (attempt + 1))
      }
    }
  } finally {
    cache.close()
  }
}
