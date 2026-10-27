import { type SdkStorage } from './storage.ts';
export declare const SDK_CONFIG_PATH_ENV = "QVAC_CONFIG_PATH";
export declare const OPENCL_CACHE_DIR_ENV = "QVAC_OPENCL_CACHE_DIR";
export declare const SDK_OPTIONS_ENV = "QVAC_SDK_OPTIONS";
export interface SdkStorageChannels {
    readonly env?: Record<string, string | undefined>;
    readonly argv?: Array<string> | null;
}
export declare function configureSdkStorage(storage: SdkStorage, channels?: SdkStorageChannels): string;
