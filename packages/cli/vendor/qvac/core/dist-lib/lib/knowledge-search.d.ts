import type { AbortSignal } from 'bare-abort-controller';
import type { ScopedCapabilities } from './mesh-scoped-engine.ts';
import type { AssistantRagSearchRequest, AssistantRagSearchResponse } from '../spec/hyperschema/types.d.ts';
export interface SearchKnowledgeOptions {
    readonly signal: AbortSignal;
    readonly preparing: (active: boolean) => void;
}
export declare function searchKnowledge(engine: Pick<ScopedCapabilities, 'ragSearch' | 'fileStatusWatch'>, request: Omit<AssistantRagSearchRequest, 'meshId'>, options: SearchKnowledgeOptions): Promise<AssistantRagSearchResponse>;
