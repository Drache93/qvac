import type { RpcServerProvider } from '../schemas/rpc-server.js';
/** Register the native server implementation explicitly, without loading any model plugin. */
export declare function registerRpcServerProvider(value: RpcServerProvider): void;
export declare function hasRpcServerProvider(): boolean;
export declare function getRpcServerProvider(): RpcServerProvider;
export declare function clearRpcServerProvider(): void;
