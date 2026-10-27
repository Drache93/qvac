// Hand-written surface for the generated (untyped) hyperschema struct codec.
import type { Codec } from 'compact-encoding'
import type { SchemaTypes } from './types.d.ts'

export declare function getStruct<Name extends keyof SchemaTypes>(
  name: Name,
  version?: number
): Codec<SchemaTypes[Name]>

export declare function encode<Name extends keyof SchemaTypes>(
  name: Name,
  value: SchemaTypes[Name],
  version?: number
): Buffer

export declare function decode<Name extends keyof SchemaTypes>(
  name: Name,
  buffer: Uint8Array,
  version?: number
): SchemaTypes[Name]
