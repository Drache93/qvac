import { stringify } from '../vendor/miniyaml.mjs'

// Keep familiar OpenAPI field/path keys readable without altering scalar values.
// The library emits JSON-quoted keys on separate block-mapping lines. Only this
// deliberately narrow, unambiguous subset is safe to turn into plain YAML keys.
const PLAIN_KEY = /^(?:[A-Za-z_][A-Za-z0-9_.-]*|\/[A-Za-z0-9_./{}-]*)$/
const RESERVED_KEY = /^(?:null|Null|NULL|true|True|TRUE|false|False|FALSE)$/

export function stringifyOpenApi(value: unknown): string {
  return stringify(value).replace(/^( *)"([^"\\]*)":/gm, (quoted, indent: string, key: string) =>
    PLAIN_KEY.test(key) && !RESERVED_KEY.test(key) ? `${indent}${key}:` : quoted
  )
}
