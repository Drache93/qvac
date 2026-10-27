import type HyperDB from 'hyperdb';
import type { QvacChunk } from '../../../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from '../../mesh.ts';
export declare function referencedBlobs(mesh: Mesh): Promise<string[]>;
export declare function attachmentChunks(snapshot: HyperDB): AsyncGenerator<QvacChunk>;
