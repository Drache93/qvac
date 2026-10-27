import type { AssistantAgent, AssistantChunk } from '../spec/hyperschema/types.d.ts';
export declare function chatKvCacheKey(chatId: string): string;
export declare function chatRepairKvCacheKey(chatId: string, acceptedRepairs: number): string;
export declare function agentSwitched(chunks: ReadonlyArray<AssistantChunk>, request: AssistantChunk, deviceId: Uint8Array): boolean;
export declare function disappearedChatIds(known: ReadonlySet<string>, current: ReadonlyArray<string>): string[];
export declare function agentRekeyFingerprint(agent: AssistantAgent): string;
