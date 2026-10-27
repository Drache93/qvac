import type { Capabilities } from '../spec/capabilities.d.ts';
export type KvCacheDeletionResult = {
    status: 'success';
} | {
    status: 'failure';
    error: string;
} | {
    status: 'unsupported';
    error: string;
};
interface LegacyCompatibleClient {
    clearKvCache?: Capabilities['clearKvCache'];
    deleteChatKvCache?: Capabilities['deleteChatKvCache'];
    deviceInfo?: Capabilities['deviceInfo'];
}
export declare function clearKvCache(client: LegacyCompatibleClient): Promise<KvCacheDeletionResult>;
export declare function deleteChatKvCache(client: LegacyCompatibleClient, chatId: string): Promise<KvCacheDeletionResult>;
export {};
