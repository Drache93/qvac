import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { connect } from 'node:net'
import { once } from 'node:events'
import createHttpServer from '@/lib/http'
import errorHandlerPlugin from '@/lib/api/core/plugins/error-handler'

async function server(errors: string[]) {
  const app = createHttpServer()
  app.decorate('qvac', { logger: { error: (line: string) => errors.push(line) } })
  await errorHandlerPlugin(app, {})
  return app
}

describe('HTTP error handler', () => {
  it('passes client errors through instead of logging them as unhandled', async (t) => {
    const errors: string[] = []
    const app = await server(errors)
    t.after(() => app.close())
    app.get('/conflict', () => {
      throw Object.assign(new Error('Already exists'), { statusCode: 409 })
    })
    const response = await app.inject('/conflict')
    assert.equal(response.statusCode, 409)
    assert.deepEqual(response.json(), {
      error: { message: 'Already exists', type: 'invalid_request_error', code: 'invalid_request' }
    })
    assert.deepEqual(errors, [])
  })

  it('answers a malformed request target with 400', async (t) => {
    const errors: string[] = []
    const app = await server(errors)
    t.after(() => app.close())
    const { port } = new URL(await app.listen({ port: 0 }))
    const socket = connect(Number(port), '127.0.0.1')
    socket.end('GET //[ HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n')
    let response = ''
    socket.setEncoding('utf8').on('data', (data: string) => (response += data))
    await once(socket, 'close')
    assert.match(response, /^HTTP\/1\.1 400 /)
    assert.deepEqual(errors, [])
  })
})
