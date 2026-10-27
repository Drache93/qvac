import type { Mesh } from '../../mesh.ts';
export declare function reclaimPurgedFiles(mesh: Mesh): Promise<number>;
export declare function chatReferences(mesh: Mesh, chatId: string): Promise<string[]>;
export declare function reclaimReferences(mesh: Mesh, references: ReadonlyArray<string>): Promise<void>;
