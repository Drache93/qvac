import { isRecord } from '../guards.ts';
import type { Patch } from './protocol-types.ts';
export { isRecord };
export type { Patch } from './protocol-types.ts';
export declare function diff(prev: unknown, next: unknown): Patch | undefined;
export declare function apply(base: unknown, patch: Patch): unknown;
