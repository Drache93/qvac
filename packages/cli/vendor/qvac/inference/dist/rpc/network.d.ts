import type { DisposableScope } from '../runtime/disposable-scope.js';
import type { AbortSignal } from 'bare-abort-controller';
export declare function rpcTopic(topic: string): import("bare-buffer");
export declare function privateEndpoint(url: string): {
    host: string;
    port: number;
} | undefined;
export declare function throwIfAborted(signal: AbortSignal): void;
export declare function delay(ms: number, signal: AbortSignal): Promise<void>;
export declare function probeTcp(host: string, port: number, timeoutMs: number, signal: AbortSignal, scope?: DisposableScope): Promise<boolean>;
export declare function waitForReady(host: string, port: number, signal: AbortSignal): Promise<void>;
