import type { Mesh } from '../../mesh.ts';
export interface IndexingDevice {
    readonly mobile: () => boolean;
    readonly peers: () => ReadonlyArray<string>;
}
export interface IndexingHost {
    readonly deviceId: Buffer | null;
    readonly chatId: string | null | undefined;
    readonly device?: IndexingDevice;
}
export declare function canIndexKnowledge(mesh: Mesh, { deviceId, chatId, device }: IndexingHost): Promise<boolean>;
