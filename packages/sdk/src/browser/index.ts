import { z } from 'zod'
import {
  completionStreamResponseSchema,
  type CompletionStreamRequest,
  type CompletionStreamResponse
} from '@qvac/inference/surface'
import { createCompletion } from '@/client/api/create-completion'
import { StreamEndedError } from '@/utils/errors-client'

const loadSchema = z
  .object({
    modelSrc: z.url().refine((value) => /^https?:/.test(value), 'Expected an HTTP(S) model URL'),
    ctxSize: z.number().int().positive().optional()
  })
  .strict()
const completionSchema = z
  .object({
    modelId: z.string().min(1),
    history: z
      .array(
        z
          .object({
            role: z.enum(['system', 'user', 'assistant']),
            content: z.string()
          })
          .strict()
      )
      .min(1),
    stream: z.boolean().optional(),
    generationParams: z
      .object({
        predict: z.number().int().positive().optional(),
        temp: z.number().nonnegative().optional(),
        seed: z.number().int().min(0).max(0xffffffff).optional()
      })
      .strict()
      .optional()
  })
  .strict()
const cancelSchema = z.union([
  z.object({ requestId: z.string().min(1) }).strict(),
  z.object({ modelId: z.string().min(1) }).strict()
])
const unloadSchema = z.object({ modelId: z.string().min(1) }).strict()

export type BrowserLoadModelOptions = z.input<typeof loadSchema>
export type BrowserCompletionParams = z.input<typeof completionSchema>
export type BrowserCancelOptions = z.input<typeof cancelSchema>

export interface BrowserRuntime {
  loadModel(options: BrowserLoadModelOptions): Promise<string>
  streamCompletion(request: CompletionStreamRequest): AsyncGenerator<CompletionStreamResponse>
  cancel(options: BrowserCancelOptions): Promise<void>
  unloadModel(options: { modelId: string }): Promise<void>
  close(): void | Promise<void>
}

/** Experimental text-only client. The runtime owns its Worker and WebGPU/WASM assets. */
export function createBrowserClient(runtime: BrowserRuntime) {
  const runCompletion = createCompletion(async function* (request) {
    for await (const raw of runtime.streamCompletion(request)) {
      const response = completionStreamResponseSchema.parse(raw)
      if (response.done) {
        if (response.events.filter((event) => event.type === 'completionDone').length !== 1) {
          throw new Error('Completion terminal frame must contain one completionDone event')
        }
      } else if (response.events.some((event) => event.type === 'completionDone')) {
        throw new Error('completionDone must occur in the terminal frame')
      }
      yield response
      if (response.done) return
    }
    throw new StreamEndedError()
  })

  return {
    loadModel(options: BrowserLoadModelOptions) {
      return runtime.loadModel(loadSchema.parse(options))
    },
    completion(params: BrowserCompletionParams) {
      const validated = completionSchema.parse(params)
      return runCompletion({ ...validated, stream: validated.stream ?? true })
    },
    cancel(options: BrowserCancelOptions) {
      return runtime.cancel(cancelSchema.parse(options))
    },
    unloadModel(options: { modelId: string }) {
      return runtime.unloadModel(unloadSchema.parse(options))
    },
    close() {
      return runtime.close()
    }
  }
}

export type { CompletionRun, CompletionEvent, CompletionFinal } from '@qvac/inference/surface'
export { InferenceCancelledError } from '@/utils/errors-server'
