import ReadyResource from 'ready-resource';
import type { Capabilities } from './api/index.ts';
import type { CapabilityHandlers } from '../spec/capabilities.d.ts';
import type { LoggerInterface } from '@qvac/logging';
import { type EngineSpec } from './spec-loader.ts';
import { type Transport } from '@qvac/harness/rpc';
export interface ClientOptions {
    logger?: LoggerInterface | null;
    spec?: () => Promise<EngineSpec>;
    handlers?: Partial<CapabilityHandlers>;
}
export interface Client extends Capabilities {
}
export declare class Client extends ReadyResource {
    private readonly _transport;
    private readonly _log;
    private readonly _spec;
    private readonly _handlers;
    private readonly _watches;
    private _stream;
    constructor(transport: Transport, { logger, spec, handlers }?: ClientOptions);
    _open(): Promise<void>;
    private _reconnecting;
    _close(): Promise<void>;
}
