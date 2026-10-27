import test from 'brittle'
import { AbortController, AbortSignal } from 'bare-abort-controller'
import { DOMParser, XMLSerializer } from '../../vendor/xmldom/lib/index.js'
import { jsonrepair } from '../../vendor/jsonrepair/lib/esm/index.js'
import {
  createActor,
  setup,
  assign,
  fromPromise,
  waitFor
} from '../../vendor/xstate/dist/xstate.cjs.mjs'
import { split } from '../../vendor/llm-splitter/dist/index.js'
import { detect, toISO3 } from '../../vendor/tinyld/dist/tinyld.heavy.node.mjs'
import isProperty from '../../vendor/is-property/is-property.js'
import varint from '../../vendor/varint/index.js'
import signedVarint from '../../vendor/signed-varint/index.js'
import {
  ReadableStream,
  TransformStream,
  WritableStream
} from '../../vendor/web-streams-polyfill/dist/ponyfill.es2018.mjs'
import { extractText, definePDFJSModule } from '../../vendor/unpdf/dist/index.mjs'

// Harness installs the same Bare abort globals before starting its actors.
globalThis.AbortController ??= AbortController
globalThis.AbortSignal ??= AbortSignal

// Exercise consumer contracts against the shipped snapshots, without resolving
// their original registry packages. The full CLI suites cover their callers.
test('XML office edits and malformed JSON argument repair', (t) => {
  const doc = new DOMParser().parseFromString(
    '<doc xmlns="urn:test"><item a="1">old</item></doc>',
    'application/xml'
  )
  const item = doc.getElementsByTagNameNS('urn:test', 'item')[0]
  item.textContent = 'A & B'
  const xml = new XMLSerializer().serializeToString(doc)
  t.ok(xml.includes('A &amp; B'))
  t.is(new DOMParser().parseFromString(xml, 'application/xml').documentElement.textContent, 'A & B')
  t.alike(JSON.parse(jsonrepair("```json\n{city: 'Sofia', values: [1, 2,],}\n```")), {
    city: 'Sofia',
    values: [1, 2]
  })
})

test('Harness state machine runs asynchronous actors and persisted snapshots', async (t) => {
  const machine = setup({
    actors: { answer: fromPromise(() => Promise.resolve(42)) }
  }).createMachine({
    initial: 'idle',
    context: { result: 0 },
    states: {
      idle: { on: { RUN: 'running' } },
      running: {
        invoke: {
          src: 'answer',
          onDone: { target: 'done', actions: assign({ result: ({ event }) => event.output }) }
        }
      },
      done: { type: 'final' }
    }
  })
  const actor = createActor(machine).start()
  actor.send({ type: 'RUN' })
  const snapshot = await waitFor(actor, (value) => value.status === 'done')
  t.is(snapshot.context.result, 42)
  const restored = createActor(machine, {
    snapshot: JSON.parse(JSON.stringify(actor.getPersistedSnapshot()))
  }).start()
  t.is(restored.getSnapshot().value, 'done')
  t.is(restored.getSnapshot().context.result, 42)
  actor.stop()
  restored.stop()
})

test('RAG splitting and language detection keep content and offsets', (t) => {
  const input = 'A short first paragraph.\n\nAnother sentence about local models.'
  const chunks = split(input, { chunkSize: 20, chunkOverlap: 0 })
  t.ok(chunks.length > 1)
  for (const chunk of chunks) t.is(chunk.text, input.slice(chunk.start, chunk.end))
  t.is(
    detect('This is an English sentence with enough words to identify the language reliably.'),
    'en'
  )
  t.is(toISO3('en'), 'eng')
})

test('Protocol encodings and generated property access stay compatible', async (t) => {
  for (const value of [0, 1, 127, 128, 65535, 2 ** 32, Number.MAX_SAFE_INTEGER]) {
    const bytes = varint.encode(value)
    t.is(varint.decode(bytes), value)
    t.is(varint.decode.bytes, varint.encodingLength(value))
  }
  for (const value of [-1048576, -1, 0, 1, 1048576]) {
    const bytes = signedVarint.encode(value)
    t.is(signedVarint.decode(bytes), value)
    t.is(signedVarint.decode.bytes, signedVarint.encodingLength(value))
  }
  t.ok(isProperty('validName'))
  t.ok(isProperty('π'))
  t.absent(isProperty('not-valid'))
  t.absent(isProperty('1name'))
  await t.exception.all(() => varint.decode([128]), RangeError)
})

test('PDF stream pipeline preserves backpressure and cancellation', async (t) => {
  const output = []
  await new ReadableStream({
    start(controller) {
      controller.enqueue('a')
      controller.enqueue('b')
      controller.close()
    }
  })
    .pipeThrough(
      new TransformStream({
        transform(value, controller) {
          controller.enqueue(value.toUpperCase())
        }
      })
    )
    .pipeTo(
      new WritableStream({
        write(value) {
          output.push(value)
        }
      })
    )
  t.alike(output, ['A', 'B'])
  let reason
  await new ReadableStream({
    cancel(value) {
      reason = value
    }
  }).cancel('done')
  t.is(reason, 'done')
})

function pdf() {
  const stream = 'BT /F1 12 Tf 30 100 Td (Local PDF extraction works) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ]
  let source = '%PDF-1.4\n'
  const offsets = [0]
  for (let i = 0; i < objects.length; i++) {
    offsets.push(source.length)
    source += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xref = source.length
  source += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, '0') + ' 00000 n \n')
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Uint8Array.from(source, (c) => c.charCodeAt(0))
}

test('PDF extraction uses the bundled engine without fetching workers', async (t) => {
  globalThis.ReadableStream ??= ReadableStream
  globalThis.TransformStream ??= TransformStream
  globalThis.WritableStream ??= WritableStream
  await definePDFJSModule(() => import('../../vendor/unpdf/dist/pdfjs.mjs'))
  const result = await extractText(pdf(), { mergePages: true })
  t.is(result.totalPages, 1)
  t.ok(result.text.includes('Local PDF extraction works'))
})
