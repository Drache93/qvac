import type { AssistantAppendChunkRequest, AssistantChunkId, AssistantChunkContentRunStatus } from '../spec/hyperschema/types.d.ts';
import type { ScopedCapabilities } from './mesh-scoped-engine.ts';
import type { LoggerInterface } from '@qvac/logging';
import { type PendingScope } from './write-queue.ts';
export type TranscriptChunk = Pick<AssistantAppendChunkRequest, 'type' | 'toolCall' | 'toolResult' | 'sources' | 'effect' | 'display' | 'rawCall' | 'round' | 'callId'>;
export type ReplacedType = 'content' | 'thinking';
export interface RunTranscriptOptions {
    chatId: string;
    runId: string;
    deviceId: Buffer;
    model: string;
    parentId?: string;
    log?: LoggerInterface | null;
}
export declare class RunTranscript {
    private readonly _engine;
    private readonly _chatId;
    private readonly _runId;
    private readonly _deviceId;
    private readonly _model;
    private readonly _parentId;
    private readonly _log;
    private readonly _writes;
    private readonly _ticker;
    private readonly _announced;
    private _buffered;
    constructor(engine: ScopedCapabilities, opts: RunTranscriptOptions);
    text(type: ReplacedType, text: string, round?: number): Promise<void>;
    chunk(chunk: TranscriptChunk): Promise<AssistantChunkId>;
    roundReset(round: number, replacedTypes: ReadonlyArray<ReplacedType>): Promise<void>;
    status(runStatus: AssistantChunkContentRunStatus, { resumed }?: {
        resumed?: boolean | undefined;
    }): Promise<AssistantChunkId>;
    progress(id: string, runStatus: AssistantChunkContentRunStatus): Promise<unknown>;
    flush(): Promise<void>;
    pending(): Array<PendingScope>;
    close(): void;
    private _announce;
}
