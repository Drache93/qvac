import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import type { QvacAgent } from '../../spec/mesh/hyperschema/types.d.ts';
import { type IndexingEmbedder, type VectorIndex } from '../core/files/index.ts';
import { type MeshPool } from './current-mesh.ts';
export declare const MAX_RAG_SEARCH_LIMIT = 20;
export interface CreateRagApiOptions {
    readonly index: (meshId: string) => VectorIndex | null;
    readonly embedder: (meshId: string) => IndexingEmbedder | null;
    readonly effectiveCtxSize?: ((agent: QvacAgent | null) => Promise<number>) | null;
}
export declare function createRagApi(pool: MeshPool, { index, embedder, effectiveCtxSize }: CreateRagApiOptions): Pick<CapabilityHandlers, 'ragSearch'>;
