// Hand-written surface for the generated hyperschema module, mirroring assistant/spec/index.d.ts.
interface Schema {
  encode<T = unknown>(name: string, value: T): Buffer
  decode<T = unknown>(name: string, buffer: Buffer): T
  getEnum<T = unknown>(name: string): T
}

export declare const harness: Schema
