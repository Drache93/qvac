import type { ModelRegistryListResponse, ModelRegistrySearchRequest, ModelRegistrySearchResponse, ModelRegistryGetModelRequest, ModelRegistryGetModelResponse, ModelRegistryEntry } from '../schemas/index.js';
import type { QVACModelEntry } from '@qvac/registry-client';
export declare function processRegistryModel(model: QVACModelEntry): ModelRegistryEntry | null;
export declare function handleModelRegistryList(): Promise<ModelRegistryListResponse>;
export declare function handleModelRegistrySearch(request: ModelRegistrySearchRequest): Promise<ModelRegistrySearchResponse>;
export declare function handleModelRegistryGetModel(request: ModelRegistryGetModelRequest): Promise<ModelRegistryGetModelResponse>;
