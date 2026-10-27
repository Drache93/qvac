import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import { type MeshPool } from './current-mesh.ts';
export { MAX_ATTACHMENT_BYTES } from '../core/files/attachments.ts';
export interface CreateAttachmentsApiOptions {
    readonly maxBytes?: number;
    readonly deviceId?: Buffer | null;
    readonly inactivityMs?: number;
}
export declare function createAttachmentsApi(pool: MeshPool, options?: CreateAttachmentsApiOptions): Pick<CapabilityHandlers, 'uploadAttachment' | 'downloadAttachment' | 'deleteAttachment'>;
