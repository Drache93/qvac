import type { Mesh, MeshView, ViewHead } from '../mesh.ts';
export declare function syncChanges(mesh: Mesh, view: MeshView, from: ViewHead): Promise<ViewHead | null>;
