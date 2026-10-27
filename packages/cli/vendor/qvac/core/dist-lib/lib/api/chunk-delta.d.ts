import { type Readable } from 'streamx';
import type { AssistantChunk, AssistantChunkDelta, AssistantChunkList } from '../../spec/hyperschema/types.d.ts';
import type { WatchStream } from '../../spec/capabilities.d.ts';
type Rows = ReadonlyMap<string, AssistantChunk>;
export declare function chunkDelta(prev: Rows | null, next: ReadonlyArray<AssistantChunk>): AssistantChunkDelta;
export declare function chunkDeltaStream(lists: Readable & AsyncIterable<AssistantChunkList>): Readable & WatchStream<AssistantChunkDelta>;
export {};
