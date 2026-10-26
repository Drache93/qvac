import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify'
import { HttpError } from '@/serve/lib/http-error'
import { resolveBinaryInput } from '@/serve/lib/binary-input'

export interface ImageFormat {
  name: string
  signature: readonly number[]
}

export const PNG: ImageFormat = {
  name: 'PNG',
  signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
}
export const JPEG: ImageFormat = { name: 'JPEG', signature: [0xff, 0xd8, 0xff] }
export const BMP: ImageFormat = { name: 'BMP', signature: [0x42, 0x4d] }

export interface ImageInput {
  /** Resolves the body's `image` and checks its format. Run it before `requireModel`, so a bad image is refused without loading the model. */
  read: preHandlerAsyncHookHandler
  /** The bytes `read` accepted for this request. */
  bytes: (req: FastifyRequest) => Buffer
}

/** The `image` field of a route whose engine decodes only `formats`. */
export function imageInput(formats: readonly ImageFormat[]): ImageInput {
  const names = formats.map((f) => f.name)
  const expected =
    names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} or ${names.at(-1)!}`
  const images = new WeakMap<FastifyRequest, Buffer>()

  return {
    // lunte-disable-next-line require-await
    async read(req) {
      const { image } = req.body as { image: Buffer | string }
      const { bytes } = resolveBinaryInput(req, 'image', image)
      if (!formats.some((f) => f.signature.every((byte, i) => bytes[i] === byte))) {
        throw new HttpError(400, 'unsupported_image_format', `image: expected a ${expected} image.`)
      }
      images.set(req, bytes)
    },
    bytes(req) {
      return images.get(req)!
    }
  }
}
