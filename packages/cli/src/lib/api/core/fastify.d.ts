import type { QvacContext, QvacRequestModel } from '@/lib/api/core/context'
import type { ParsedFile } from '@/lib/api/lib/multipart'

declare module 'fastify' {
  interface FastifyInstance {
    qvac: QvacContext
  }
  interface FastifyRequest {
    qvacModel?: QvacRequestModel
    bindCancel: (requestId: string) => void
    multipartFiles?: ParsedFile[]
  }
  interface FastifyContextConfig {
    unsupportedParams?: string[]
    sseSentinel?: boolean
  }
}
