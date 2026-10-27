import type * as QvacSdk from '@qvac/inference';
import type { ModelRegistryEntryAddon } from '@qvac/inference';
import type { ModelSrc } from './context.ts';
export type ModelRegistrySdk = Pick<typeof QvacSdk, 'modelRegistrySearch'>;
export type ModelAddon = ModelRegistryEntryAddon;
export declare function resolveModelSrc(sdk: ModelRegistrySdk, model: string, addon?: ModelAddon): Promise<ModelSrc>;
export declare function resolveProjectionSrc(sdk: ModelRegistrySdk, model: string): Promise<ModelSrc>;
