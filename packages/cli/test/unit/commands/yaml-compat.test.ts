import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '../../../src/lib/vendor/miniyaml-openapi.mjs'
import { parse as parseCore, stringify } from '../../../src/lib/vendor/miniyaml.mjs'
import { stringifyOpenApi } from '@/lib/openai/yaml'
import { parseSpec } from '@/lib/openai/coverage/parse-spec'

// Expected values were checked against the previous installed js-yaml 4.3.2.
describe('OpenAPI YAML default-schema compatibility', () => {
  it('merges aliases in schema order, preserves overrides and quoted merge-like keys', () => {
    const result = parse(`a: &a {x: 1, z: 1}
b: &b {x: 2, y: 2}
value:
  <<: [*a, *b]
  z: 3
literal: {'<<': {x: 1}}
explicit: {!!merge '<<': *a}
`)
    assert.deepEqual(result, {
      a: { x: 1, z: 1 },
      b: { x: 2, y: 2 },
      value: { x: 1, z: 3, y: 2 },
      literal: { '<<': { x: 1 } },
      explicit: { x: 1, z: 1 }
    })
    assert.throws(() => parse('x: {<<: 1}'))
    assert.throws(() => parse('x: {a: 1, a: 2}'))
  })

  it('retains v4 scalar resolution without YAML 1.1 yes/no coercion', () => {
    const fixtures: Array<[string, unknown]> = [
      ['null', null],
      ['~', null],
      ['True', true],
      ['yes', 'yes'],
      ['no', 'no'],
      ['on', 'on'],
      ['off', 'off'],
      ['-0', 0],
      ['-00', -0],
      ['012', 12],
      ['0b101', 5],
      ['-0b10', -2],
      ['+0o17', 15],
      ['-0xF', -15],
      ['1_000', '1_000'],
      ['1e5', 100000],
      ['+.5', '+.5'],
      ['-.5', '-.5'],
      ['.5', 0.5],
      ['-.inf', -Infinity],
      ['.NaN', NaN]
    ]
    for (const [source, expected] of fixtures) assert.deepEqual(parse(source), expected, source)
  })

  it('preserves timestamp, binary, set, pairs, ordered-map and complex-key values', () => {
    assert.deepEqual(parse('2001-12-15T02:59:43.1Z'), new Date('2001-12-15T02:59:43.100Z'))
    // v4 intentionally used Date.UTC normalization, including years below 100.
    assert.deepEqual(parse('0001-01-01'), new Date('1901-01-01T00:00:00Z'))
    assert.deepEqual(parse('2020-02-31'), new Date('2020-03-02T00:00:00Z'))
    assert.deepEqual(parse('!!binary SGVsbG8='), new Uint8Array([72, 101, 108, 108, 111]))
    assert.deepEqual(parse('!!set {one: null, two: null}'), { one: null, two: null })
    assert.deepEqual(parse('!!omap [{a: 1}, {b: 2}]'), [{ a: 1 }, { b: 2 }])
    assert.deepEqual(parse('!!pairs [{a: 1}, {a: 2}]'), [
      ['a', 1],
      ['a', 2]
    ])
    assert.deepEqual(parse('? [a, b]\n: value'), { 'a,b': 'value' })
    assert.throws(() => parse('!!set {one: 1}'))
    assert.throws(() => parse('!!binary "!"'))
  })

  it('keeps dangerous keys as data and preserves alias identity', () => {
    const value = parse('__proto__: &a {safe: true}\ncopy: *a') as Record<string, unknown>
    assert.equal(Object.getPrototypeOf(value), Object.prototype)
    assert.equal(Object.hasOwn(value, '__proto__'), true)
    assert.equal(value['copy'], value['__proto__'])
    assert.equal(Object.getPrototypeOf(value).safe, undefined)
  })

  it('keeps public miniyaml Core separate and round-trips emitted OpenAPI data', () => {
    assert.deepEqual(parseCore('x: {<<: {a: 1}}'), { x: { '<<': { a: 1 } } })
    assert.equal(parseCore('2001-12-15'), '2001-12-15')
    const document = {
      openapi: '3.1.0',
      paths: {
        '/v1/chat/completions': {
          post: { summary: 'yes', responses: { '200': { description: 'OK' } } }
        }
      }
    }
    assert.deepEqual(parse(stringify(document)), document)
    assert.deepEqual(parse(stringifyOpenApi(document)), document)
    const tricky = {
      true: 'false',
      null: '~',
      '<<': { x: 1 },
      'a: b': 'line\\nnext',
      'a\"b': 'value',
      '/path/{id}': { yes: 'no' }
    }
    assert.deepEqual(parse(stringifyOpenApi(tricky)), tricky)
  })

  it('extracts HTTP operations inherited through YAML aliases', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'qvac-yaml-merge-'))
    try {
      const file = join(dir, 'spec.yaml')
      writeFileSync(
        file,
        `operation: &op {operationId: inheritedChat, tags: [chat]}
paths:
  /chat/completions:
    post: {<<: *op}
`
      )
      const result = await parseSpec({ specPath: file })
      assert.equal(result.entries.length, 1)
      assert.equal(result.entries[0]?.operationId, 'inheritedChat')
      assert.equal(result.entries[0]?.path, '/v1/chat/completions')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
