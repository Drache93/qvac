import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { BMP, JPEG, PNG, imageInput } from '@/serve/lib/image-input'
import { HttpError } from '@/serve/lib/http-error'

function request(image: Buffer): FastifyRequest {
  return { body: { image } } as unknown as FastifyRequest
}

async function read(input: ReturnType<typeof imageInput>, req: FastifyRequest): Promise<void> {
  await input.read.call(undefined as never, req, {} as FastifyReply)
}

describe('imageInput', () => {
  it('keeps the bytes of an image in an accepted format', async () => {
    const input = imageInput([PNG, JPEG])
    const req = request(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))
    await read(input, req)
    assert.deepEqual(input.bytes(req), Buffer.from([0xff, 0xd8, 0xff, 0xe0]))
  })

  it('needs the whole PNG signature, not only its first bytes', async () => {
    const input = imageInput([PNG])
    const req = request(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]))
    await assert.rejects(read(input, req), (err: unknown) => {
      assert.ok(err instanceof HttpError)
      assert.equal(err.code, 'unsupported_image_format')
      return true
    })
  })

  it('names the accepted formats when it refuses one', async () => {
    const input = imageInput([PNG, JPEG, BMP])
    await assert.rejects(read(input, request(Buffer.from('GIF89a'))), {
      message: 'image: expected a PNG, JPEG or BMP image.'
    })
  })
})
