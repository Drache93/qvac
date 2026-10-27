export declare const CHUNK_TYPES: string[];
export declare const RUN_STATES: string[];
export declare const APPROVAL_STATUSES: string[];
export declare const ENHANCE_MODES: string[];
export declare const MODEL_REQUEST_STATES: string[];
export declare const CHUNK_PAYLOAD_FIELDS: {
    readonly 'user-message': 'userMessage';
    readonly content: 'content';
    readonly thinking: 'thinking';
    readonly 'tool-call': 'toolCall';
    readonly 'tool-result': 'toolResult';
    readonly attachment: 'attachment';
    readonly 'approval-request': 'approvalRequest';
    readonly 'run-status': 'runStatus';
    readonly 'run-request': 'runRequest';
    readonly sources: 'sources';
    readonly compaction: 'compaction';
    readonly context: 'context';
    readonly 'model-request': 'modelRequest';
    readonly 'round-reset': 'roundReset';
    readonly 'agent-switch': 'agentSwitch';
};
export type ChunkType = keyof typeof CHUNK_PAYLOAD_FIELDS;
export type ChunkPayloadField = (typeof CHUNK_PAYLOAD_FIELDS)[ChunkType];
export interface Registry {
    register(definition: object): void;
}
export interface CollectionRegistry {
    require(helpersPath: string): void;
    readonly collections: Registry;
    readonly indexes: Registry;
}
export interface Field {
    readonly name: string;
    readonly type: string;
    readonly required?: boolean;
    readonly array?: boolean;
    readonly useDefault?: boolean;
}
export declare function versionedRegistrar(ns: Registry, namespace: string): (name: string, ...versions: ReadonlyArray<ReadonlyArray<Field>>) => void;
export declare function registerContentTypes(ns: Registry, namespace: string): void;
