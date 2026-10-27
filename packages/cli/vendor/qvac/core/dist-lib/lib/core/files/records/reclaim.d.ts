import type { QvacKnowledge, QvacKnowledgeArtifact } from '../../../../spec/mesh/hyperschema/types';
import type { Mesh } from '../../mesh.ts';
export declare function syncKnowledgeTombstone(mesh: Mesh, row: QvacKnowledge): Promise<void>;
export declare function syncArtifactArrival(mesh: Mesh, row: QvacKnowledgeArtifact): Promise<void>;
export declare function sweepTombstonedBlobs(mesh: Mesh, deviceId?: Buffer | null): Promise<void>;
