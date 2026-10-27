import type { LoggerInterface } from '@qvac/logging';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import { type MeshPool } from './current-mesh.ts';
export { MAX_KNOWLEDGE_BYTES } from '../core/files/knowledge.ts';
export interface CreateKnowledgeApiOptions {
    readonly maxBytes?: number;
    readonly inactivityMs?: number;
    readonly deviceId?: Buffer | null;
    readonly mobile?: () => boolean;
    readonly log: LoggerInterface | null;
}
export declare function createKnowledgeApi(pool: MeshPool, options: CreateKnowledgeApiOptions): Pick<CapabilityHandlers, 'uploadKnowledge' | 'downloadKnowledge' | 'removeKnowledge' | 'listKnowledge' | 'knowledgeWatch' | 'listIndexing' | 'indexingWatch' | 'fileStatusWatch' | 'indexingProgressWatch' | 'listKnowledgeBase' | 'knowledgeBaseWatch' | 'fileKnowledge' | 'setKnowledgeCap' | 'getKnowledge'>;
