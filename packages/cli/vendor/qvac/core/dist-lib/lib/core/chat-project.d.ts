import type { Mesh } from './mesh.ts';
export declare function chatProject(chatMesh: Mesh, chatId: string, open: (projectId: string) => Promise<Mesh | null>): Promise<Mesh | null>;
