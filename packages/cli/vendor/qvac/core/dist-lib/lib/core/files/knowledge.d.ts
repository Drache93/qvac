import type { AssistantFileKnowledgeRequest, AssistantKnowledge } from '../../../spec/hyperschema/types.d.ts';
import { MAX_KNOWLEDGE_BYTES } from './rag/index.ts';
import type { Mesh } from '../mesh.ts';
import { type FileHandlersOptions } from './upload.ts';
import type { CapabilityHandlers } from '../../../spec/capabilities.d.ts';
export { MAX_KNOWLEDGE_BYTES };
export type FileKnowledgeRequest = Omit<AssistantFileKnowledgeRequest, 'meshId'>;
export interface KnowledgeFiles extends Pick<CapabilityHandlers, 'uploadKnowledge' | 'downloadKnowledge' | 'listKnowledge' | 'removeKnowledge' | 'listIndexing'> {
    fileKnowledge(request: FileKnowledgeRequest): Promise<AssistantKnowledge>;
}
export interface KnowledgeFilesOptions extends FileHandlersOptions {
    readonly mobile?: () => boolean;
}
export declare function knowledgeFiles(mesh: Mesh, { maxBytes, inactivityMs, deviceId, mobile }?: KnowledgeFilesOptions): KnowledgeFiles;
export declare function setKnowledgeCap(mesh: Mesh, bytes: number): Promise<void>;
