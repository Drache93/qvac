import { type CollectionRegistry, type Registry } from './content.ts';
export { APPROVAL_STATUSES, CHUNK_PAYLOAD_FIELDS, CHUNK_TYPES, MODEL_REQUEST_STATES, RUN_STATES, registerContentTypes, type ChunkPayloadField, type ChunkType } from './content.ts';
export declare const INDEXING_STATES: string[];
export declare const CAPABILITY_PROFILES: string[];
export declare const APP_CHANNELS: string[];
export declare const RAG_SOURCE_EXCERPT_CHARS = 280;
export declare const MAX_RAG_SOURCES_PER_CHUNK = 1024;
export declare const MAX_RAG_SOURCE_NOTICE_CHARS = 1024;
export declare const MAX_RAG_SOURCE_URL_CHARS = 2048;
export interface BoundedRagSource {
    readonly excerpt: string;
    readonly url?: string | null;
}
export interface BoundedRagSources {
    readonly sources: ReadonlyArray<BoundedRagSource>;
    readonly notice?: string | null;
}
export declare function ragSourcesWithinBounds(content: BoundedRagSources | null | undefined): boolean;
export declare const MAX_TOOL_CONFIGS_BYTES: number;
export declare function toolConfigsWithinBounds(settings: unknown): boolean;
export declare const MAX_TOOL_ACTIVITY_ARGS_BYTES: number;
export declare function capToolActivityArguments(args: unknown): unknown;
export declare const MAX_DEVICE_NAME_CHARS = 100;
export declare function deviceNameWithinBounds(name: string): boolean;
export declare function capDeviceName(name: string): string;
export declare const MAX_MESH_NAME_CHARS = 100;
export declare function meshNameWithinBounds(name: string): boolean;
export declare const MAX_PROJECT_ORDER_IDS = 500;
export declare function registerQvacTypes(ns: Registry): void;
export declare function registerQvacCollections(dbns: CollectionRegistry, helpersPath: string): void;
export declare function registerQvacDispatch(ds: Registry): void;
