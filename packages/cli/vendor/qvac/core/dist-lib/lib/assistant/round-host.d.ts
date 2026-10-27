import { type AbortSignal } from 'bare-abort-controller';
import type { LoggerInterface } from '@qvac/logging';
import type { AssistantChunk, AssistantChunkList } from '../../spec/hyperschema/types.d.ts';
import type { Capabilities, WatchStream } from '../api/index.ts';
import type { Harness } from './harness.ts';
import { type MediaSource } from './model-round.ts';
export interface RoundHostOptions {
    readonly engine: Capabilities;
    readonly serve: NonNullable<Harness['serveModelRound']>;
    readonly deviceId: () => Buffer;
    readonly media?: RoundMedia | null;
    readonly log?: LoggerInterface | null;
}
export interface RoundMedia {
    resolve(sources: ReadonlyArray<MediaSource>, served: {
        readonly id: string;
        readonly modelId: string;
        readonly signal: AbortSignal;
    }): Promise<Array<string | null>>;
    release(id: string): void;
}
export declare function servedCacheKey(round: AssistantChunk, ownerKey: string | null | undefined): string | undefined;
export declare class RoundHost {
    private readonly _opts;
    private readonly _serving;
    private readonly _keys;
    private readonly _built;
    constructor(opts: RoundHostOptions);
    follow(meshId: string, frames: WatchStream<AssistantChunkList>): Promise<void>;
    left(chatId: string, agentId: string): string[];
    stop(): void;
    private _reconcile;
    private _pick;
    private _serve;
    private _take;
    private _provides;
    private _answer;
    private _probe;
    private _claimKey;
    private _retake;
    private _takeFor;
}
