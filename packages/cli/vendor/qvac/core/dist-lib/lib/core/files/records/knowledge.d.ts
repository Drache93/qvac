import type HyperDB from 'hyperdb';
import type { QvacKnowledge, QvacKnowledgeArtifact, QvacRemoveKnowledgeOperation } from '../../../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from '../../mesh.ts';
export type AddKnowledgeInput = Pick<QvacKnowledge, 'fileName' | 'mimeType' | 'byteLength' | 'blobId'> & Partial<Pick<QvacKnowledge, 'id' | 'chatId'>>;
export interface ChatScope {
    readonly chatId: string;
}
export interface KnowledgeRoom {
    readonly capBytes: number;
    readonly bytes: number;
}
export interface KnowledgeScope {
    readonly knowledgeId: string;
}
export declare function getKnowledge(store: Mesh, id: string): Promise<QvacKnowledge | null>;
export declare function mustGetKnowledge(store: Mesh, id: string): Promise<QvacKnowledge>;
export declare function listKnowledge(store: Mesh, { chatId }: ChatScope): Promise<QvacKnowledge[]>;
export declare function listKnowledgeBase(store: Mesh): Promise<QvacKnowledge[]>;
export declare function usedKnowledgeBytes(rows: ReadonlyArray<QvacKnowledge>): number;
export declare function knowledgeCapBytes(db: HyperDB): Promise<number>;
export declare function assertKnowledgeRoom(store: Mesh, bytes: number): Promise<KnowledgeRoom>;
export declare function addKnowledge(store: Mesh, input: AddKnowledgeInput): Promise<QvacKnowledge>;
export declare function assertRemovableAt(at: number): void;
export declare function removeKnowledge(store: Mesh, { knowledgeId, at }: QvacRemoveKnowledgeOperation): Promise<QvacKnowledge>;
export type AddKnowledgeArtifactInput = Omit<QvacKnowledgeArtifact, 'createdAt'>;
export declare function getKnowledgeArtifact(store: Mesh, id: string): Promise<QvacKnowledgeArtifact | null>;
type KnowledgeSnapshot = ReturnType<Mesh['view']['snapshot']>;
export declare function listKnowledgeArtifactsByKnowledge(store: Mesh, { knowledgeId }: KnowledgeScope): Promise<QvacKnowledgeArtifact[]>;
export declare function findKnowledgeArtifactsByKnowledge(snap: KnowledgeSnapshot, knowledgeId: string): Promise<QvacKnowledgeArtifact[]>;
export declare function addKnowledgeArtifact(store: Mesh, input: AddKnowledgeArtifactInput): Promise<QvacKnowledgeArtifact>;
export {};
