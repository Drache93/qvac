import type { Mesh } from '../mesh.ts';
import { type FileHandlersOptions } from './upload.ts';
import type { CapabilityHandlers } from '../../../spec/capabilities.d.ts';
export declare const MAX_ATTACHMENT_BYTES: number;
type Bound<K extends keyof CapabilityHandlers> = CapabilityHandlers[K] extends (input: infer I, ...rest: infer R) => infer O ? (input: Omit<I, 'meshId'>, ...rest: R) => O : CapabilityHandlers[K];
export interface BoundAttachments {
    uploadAttachment: CapabilityHandlers['uploadAttachment'];
    downloadAttachment: Bound<'downloadAttachment'>;
    deleteAttachment: Bound<'deleteAttachment'>;
}
export declare function attachmentFiles(mesh: Mesh, { maxBytes, deviceId, inactivityMs }?: FileHandlersOptions): BoundAttachments;
export {};
