import { type ModelRoundIo, type ModelRoundPort, type ModelRoundRequest } from '@qvac/harness';
import type { AbortSignal } from 'bare-abort-controller';
import type { AssistantChunk, AssistantChunkContentModelRequest, AssistantChunkDelta } from '../../spec/hyperschema/types.d.ts';
import type { ScopedCapabilities } from '../mesh-scoped-engine.ts';
import { type AttachmentRef } from './message.ts';
import { type ProbeKind } from '../probe-rounds.ts';
export interface MediaRef {
    readonly id: string;
    readonly page?: number | undefined;
    readonly frame?: number | undefined;
    readonly frames?: number | undefined;
}
export interface MediaSource {
    readonly ref: MediaRef;
    readonly attachment: AttachmentRef;
    readonly digest?: AttachmentRef | undefined;
}
export type MediaResolver = (sources: ReadonlyArray<MediaSource>, modelId: string) => Promise<Array<string | null>>;
export interface OwnerRoundsOptions {
    readonly engine: ScopedCapabilities;
    readonly chatId: string;
    readonly runId: string;
    readonly agentId: string;
    readonly deviceId: Buffer;
    readonly from: number;
    readonly media?: ((file: string) => MediaRef | undefined) | undefined;
}
interface Echo {
    readonly type: 'content' | 'thinking';
    readonly text: string;
}
export interface Probe {
    readonly kind: ProbeKind;
    readonly prompt: string;
    readonly modelId: string;
    readonly responseFormat?: ModelRoundRequest['responseFormat'];
    readonly signal: AbortSignal;
}
export interface OutputHooks {
    forwarded(echo: Echo): void;
    retook(): void;
}
export declare class OwnerRounds {
    readonly port: ModelRoundPort;
    inputLength: number;
    share: ((agentId: string) => Promise<void>) | null;
    private readonly _opts;
    private readonly _echoes;
    private _known;
    private _contextSent;
    private _rounds;
    private _retakes;
    constructor(opts: OwnerRoundsOptions);
    get rounds(): number;
    retook(): boolean;
    echoed(type: string, text: string): boolean;
    private _round;
    probe({ kind, prompt, modelId, responseFormat, signal }: Probe): Promise<string>;
    private _probed;
    private _dropOnHostLoss;
    private _ask;
    private _modelOf;
    private _switchedTo;
    private _sendContext;
    private _options;
    private _media;
    private _knownSets;
    private _readKnownSets;
    private _follow;
    private _followHost;
}
export declare class RoundOutput {
    private _id;
    private readonly _io;
    private readonly _hooks;
    private readonly _rows;
    private readonly _emitted;
    private _emit;
    private _taker;
    private _takenAt;
    private _reopened;
    private _resetAt;
    constructor(id: string, io: ModelRoundIo, hooks: OutputHooks);
    apply(frame: AssistantChunkDelta): AssistantChunkContentModelRequest | undefined;
    reask(id: string, emit: ModelRoundIo['emit']): void;
    round(): AssistantChunkContentModelRequest | undefined;
    switchedTo(from: number): string | undefined;
    newest(): number;
    resetSince(seq: number, deviceId: Buffer): boolean;
    private _take;
    private _forward;
}
export declare function listRoundChunks(engine: Pick<ScopedCapabilities, 'listChunks'>, chatId: string): Promise<AssistantChunk[]>;
export declare function servedRequest(engine: ScopedCapabilities, round: AssistantChunk, media?: MediaResolver): Promise<ModelRoundRequest | null>;
export {};
