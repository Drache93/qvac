import type { AbortSignalLike, Request, Response } from '../schemas/index.js';
/** Passed to a stream handler with `endsOnAbort`. */
export interface StreamHandlerContext {
    /** Aborts when the caller stops reading. */
    signal?: AbortSignalLike;
}
export type ReplyHandler = (request: any, ...args: any[]) => Promise<Response> | Response;
export type StreamHandler = (request: any, ...args: any[]) => AsyncGenerator<Response>;
export type ProgressHandler = (request: any, ...args: any[]) => Promise<Response>;
export type DuplexStreamHandler = (request: any, inputStream: any) => AsyncGenerator<Response>;
export type HandlerEntry = {
    type: 'reply' | 'stream' | 'duplex';
    handler: ReplyHandler | StreamHandler | ProgressHandler | DuplexStreamHandler;
    supportsProgress?: boolean | ((request: Request) => boolean);
    pluginOp?: boolean;
    endsOnAbort?: boolean;
};
