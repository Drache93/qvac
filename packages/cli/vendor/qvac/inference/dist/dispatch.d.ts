import type { Request, Response, RPCOptions, AbortableRPCOptions } from './schemas/index.js';
import Buffer from 'bare-buffer';
export declare function send<T extends Request>(request: T, _options?: RPCOptions): Promise<Response>;
/** `options.signal` ends the stream only for a handler with `endsOnAbort`. */
export declare function stream<T extends Request>(request: T, options?: AbortableRPCOptions): AsyncGenerator<Response>;
export interface DuplexWritable {
    write(chunk: Uint8Array): void;
    end(): void;
    destroy(): void;
}
export interface DuplexReadable extends AsyncIterable<Buffer | string> {
    destroy(): void;
}
export interface DuplexSession {
    requestStream: DuplexWritable;
    responseStream: DuplexReadable;
}
export declare function duplex<T extends Request>(request: T, _options?: RPCOptions): Promise<DuplexSession>;
export declare function close(): Promise<void>;
