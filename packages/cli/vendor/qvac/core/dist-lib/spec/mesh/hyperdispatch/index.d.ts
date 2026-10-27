// Hand-written surface for the generated hyperdispatch runtime (see schema/build.ts
// HAND_WRITTEN). The generated .js is untyped; consumers resolved it as any in the
// monorepo too — workspace symlinks let tsc infer node_modules JS, real installs don't.
export const version: number
export function encode(name: string, value: unknown): Buffer
export function decode(buffer: Uint8Array): any
export class Router {
  constructor(...args: any[])
  [key: string]: any
}
export class DispatchError extends Error {
  [key: string]: any
}
