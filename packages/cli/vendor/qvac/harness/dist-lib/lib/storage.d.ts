export declare const MODEL_CACHE_PATH_ENV = "QVAC_MODEL_CACHE_PATH";
export declare const SDK_HOME_ENV = "SNAP_USER_COMMON";
export type ReleaseChannel = 'prod' | 'staging' | 'dev';
export interface StorageOverrides {
    readonly root?: string | null;
    readonly models?: string | null;
}
export interface SdkStorage {
    readonly home: string;
    readonly models: string;
}
export interface AssistantStorage {
    readonly root: string;
    readonly assistant: string;
    readonly sdk: SdkStorage;
}
export declare function releaseChannel(environment: string): ReleaseChannel;
export declare function resolveStorage(channel: ReleaseChannel, overrides?: StorageOverrides, env?: Readonly<Record<string, string | undefined>>): AssistantStorage;
