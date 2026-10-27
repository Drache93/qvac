import type { LoggerInterface } from '@qvac/logging';
import type { AssistantCustomModelPreview, AssistantDeleteModelResponse, AssistantPreviewCustomModelRequest } from '../../spec/hyperschema/types.d.ts';
import type { openLocalStore } from '../core/local/index.ts';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
type LocalStore = Awaited<ReturnType<typeof openLocalStore>>;
export declare const CUSTOM_MODEL_ID_PREFIX = "custom:";
export declare function customModelId(src: string): string;
export type CustomModelFileDelete = (request: {
    name: string;
}) => Promise<AssistantDeleteModelResponse>;
export type CustomModelPreviewSource = (request: AssistantPreviewCustomModelRequest) => Promise<AssistantCustomModelPreview>;
export interface CreateCustomModelApiOptions {
    readonly preview: CustomModelPreviewSource | null;
    readonly deleteFiles: CustomModelFileDelete | null;
    readonly log: LoggerInterface | null;
}
export declare function createCustomModelApi(state: LocalStore, { preview, deleteFiles, log }: CreateCustomModelApiOptions): Pick<CapabilityHandlers, 'customModelsWatch' | 'addCustomModel' | 'removeCustomModel' | 'previewCustomModel'>;
export {};
