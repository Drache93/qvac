import type HyperDB from 'hyperdb';
import type { Router } from '../../../spec/mesh/hyperdispatch/index.js';
import type { QvacChunk } from '../../../spec/mesh/hyperschema/types.d.ts';
import type { RouterContext } from './types.ts';
export declare function runRequestOf(db: HyperDB, chatId: string, runId: string): Promise<QvacChunk | null>;
type Signed = Pick<RouterContext, 'tx' | 'node'>;
export declare function ownRunRequest(context: Signed, chatId: string | null | undefined, runId: string): Promise<QvacChunk | null>;
export declare function registerChunkRoutes(router: Router): void;
export {};
