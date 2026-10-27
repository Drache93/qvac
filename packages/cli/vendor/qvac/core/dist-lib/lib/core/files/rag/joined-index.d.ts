import { type VectorIndex } from 'rag-extract';
export interface JoinedIndexOptions {
    readonly chatId: string;
    readonly knowledgeBaseIds: ReadonlySet<string>;
}
export declare function joinedIndex(indexes: ReadonlyArray<VectorIndex>, { chatId, knowledgeBaseIds }: JoinedIndexOptions): VectorIndex;
