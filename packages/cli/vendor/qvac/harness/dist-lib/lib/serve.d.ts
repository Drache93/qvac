import { type Stream } from './rpc-session.ts';
import type { HarnessContract } from './contract-types.ts';
export declare function serveHarness(stream: Stream, harness: HarnessContract): void;
