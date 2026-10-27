import type { AssistantModelCatalogRevision, AssistantModelInfo, AssistantModelInfoList } from '../spec/hyperschema/types.d.ts';
type Catalog = () => Promise<AsyncIterable<AssistantModelCatalogRevision> | null>;
type Read = () => Promise<AssistantModelInfoList | null>;
export declare function watchModels(catalog: Catalog, read: Read): AsyncIterable<AssistantModelInfoList>;
export declare function asEncoded(models: AssistantModelInfo[]): AssistantModelInfo[];
export {};
