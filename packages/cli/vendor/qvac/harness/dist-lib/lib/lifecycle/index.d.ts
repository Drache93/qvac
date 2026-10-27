import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { CompletionEvent } from '../contract/index.ts';
import { type LoadTracker } from '../models/model-pool.ts';
import type { SdkLoader } from '../sdk-loader.ts';
import { trackCompletion } from './completion-run.ts';
type LifecycleRequest = 'PRESUSPEND' | 'SUSPEND' | 'RESUME' | 'WAKEUP';
export interface LifecycleResource {
    readonly opened: boolean;
    readonly closing: Promise<void> | null;
    readonly closed: boolean;
    ready(): Promise<void>;
}
export interface LifecycleReleases {
    pools(): Array<Promise<unknown> | undefined>;
    runtimes(): Array<Promise<unknown>>;
    plugins(): Promise<Array<PromiseSettledResult<unknown>>>;
}
export interface LifecycleOptions {
    resource: LifecycleResource;
    sdk: Pick<SdkLoader, 'peek'>;
    loads: LoadTracker;
    releases: LifecycleReleases;
    models(): string[];
    recreate(): void;
    statusChanged(): void;
    teardown(): Promise<void>;
}
export declare class Lifecycle {
    static trackCompletion: typeof trackCompletion;
    private readonly _resource;
    private readonly _sdk;
    private readonly _loads;
    private readonly _releases;
    private readonly _models;
    private readonly _recreate;
    private readonly _statusChanged;
    private readonly _teardown;
    private readonly _machine;
    private readonly _completionRuns;
    private readonly _detachedRuns;
    private readonly _effectDrainWaiters;
    private _activeWork;
    private readonly _workDrainWaiters;
    private _runtimeDraining;
    private _runtimeUnloadFailed;
    private _poolUnloadFailed;
    private _poolCleanupFailed;
    private readonly _failedModelUnloads;
    private _sdkClosed;
    private _runtimesReleased;
    private _closeRequested;
    constructor(opts: LifecycleOptions);
    get suspended(): boolean;
    get draining(): boolean;
    get unloadFailed(): boolean;
    get closeRequested(): boolean;
    requestClose(): void;
    get opened(): boolean;
    get closing(): Promise<void> | null;
    ready(): Promise<void>;
    send(type: LifecycleRequest, { open }?: {
        open?: boolean | undefined;
    }): Promise<void>;
    abortCompletions(): void;
    assertNotClosing(): void;
    enterWork(): () => void;
    trackCompletion(createSource: (signal: BareAbortSignal) => AsyncGenerator<CompletionEvent>, signal: BareAbortSignal | undefined): AsyncGenerator<CompletionEvent>;
    trackDetachedRun(pending: Promise<void>, runId?: string): void;
    recordModelUnloadFailure(modelId: string, error: unknown): void;
    recordPoolCleanupFailure(): void;
    close(): Promise<void>;
    finishClose(): Promise<void>;
    private _waitForWorkDrain;
    private _effectsSettled;
    private _notifyEffectDrain;
    private _waitForEffectDrain;
    private _closeCompletions;
    private _suspendRuntimes;
    private _sdkLifecycle;
    private _releaseRuntimes;
    private _resumeRuntimes;
}
export {};
