import type { QvacChunk } from '../../../spec/mesh/hyperschema/types';
import type { Mesh } from '../mesh';
export interface NotificationEvent {
    readonly chatId: string;
    readonly chunkId: string;
    readonly seq: number;
    readonly type: 'run-status' | 'approval-request' | 'user-message';
}
export declare function syncNotificationChunk(mesh: Mesh, chunk: QvacChunk): void;
