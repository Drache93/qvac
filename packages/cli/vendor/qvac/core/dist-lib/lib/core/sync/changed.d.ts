import type { ViewChange } from 'hyperdb';
import type { QvacAgent, QvacChat, QvacChunk, QvacChunkCounter, QvacDevice, QvacIndexingStatus, QvacKnowledge, QvacKnowledgeArtifact, QvacPurgedChat } from '../../../spec/mesh/hyperschema/types.d.ts';
import { AGENTS, CHATS, CHUNKS, CHUNK_COUNTERS, DEVICES, INDEXING_STATUS, KNOWLEDGE, KNOWLEDGE_ARTIFACTS, PURGED_CHATS } from '../collections.ts';
export interface ChangedRows {
    [AGENTS]: QvacAgent;
    [DEVICES]: QvacDevice;
    [CHATS]: QvacChat;
    [CHUNK_COUNTERS]: QvacChunkCounter;
    [CHUNKS]: QvacChunk;
    [INDEXING_STATUS]: QvacIndexingStatus;
    [KNOWLEDGE]: QvacKnowledge;
    [KNOWLEDGE_ARTIFACTS]: QvacKnowledgeArtifact;
    [PURGED_CHATS]: QvacPurgedChat;
}
export type ChangedRow<C extends keyof ChangedRows> = ViewChange & {
    readonly collection: C;
    readonly value: ChangedRows[C];
};
export declare function changed<C extends keyof ChangedRows>(change: ViewChange, collection: C): change is ChangedRow<C>;
export declare function liveRow<C extends keyof ChangedRows>(change: ChangedRow<C>): ChangedRows[C] | null;
