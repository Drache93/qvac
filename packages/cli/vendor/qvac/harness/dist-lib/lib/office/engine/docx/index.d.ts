import { Document } from './document.ts';
import type { OpenOptions } from '../opc/package.ts';
import type { CreateOptions } from './template.ts';
export { Document } from './document.ts';
export type * from './document.ts';
export declare function open(bytes: Uint8Array | ArrayBuffer, opts?: OpenOptions): Document;
export declare function create(opts?: CreateOptions): Document;
