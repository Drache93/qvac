import { type AbortSignal } from 'bare-abort-controller';
import { type AgentSkillModelInput, type HostCapability } from '@qvac/harness/lib/models/model-catalog.ts';
import { type MusicModelChoice } from '@qvac/harness/music-catalog';
import type { AssistantAppConfig } from '../spec/hyperschema/types.d.ts';
import { type ModelProgressFrame } from '@qvac/harness/model-progress';
import { type StatusRow } from './model-download-status.ts';
import type { LoggerInterface } from '@qvac/logging';
export interface DownloadArgs {
    model: string;
    addon?: string;
    seed?: boolean;
    signal?: AbortSignal;
}
export interface ImageDownloadObservation {
    readonly model: string;
    readonly phase: 'downloading' | 'complete';
    readonly percentage: number;
    readonly downloaded: number;
    readonly total: number;
}
export type DownloadFrame = ModelProgressFrame;
export type DownloadEventStream = AsyncIterable<ModelProgressFrame>;
export interface CacheWaitOptions {
    readonly onHold?: () => void;
}
interface DownloadHarness {
    list?(options?: {
        cachedOnly?: boolean;
    }): Promise<ReadonlyArray<{
        name: string;
        type: string;
        isCached: boolean;
        expectedSize?: number;
    }>>;
    infraModels?(profile: string): Promise<ReadonlyArray<{
        name: string;
        addon: string;
    }>>;
    capability?(): Promise<ProbedCapability>;
    download?(args: DownloadArgs): DownloadEventStream;
}
type ProbedCapability = Omit<HostCapability, 'mobile'>;
interface ToolConfigRow {
    toolName?: string | null;
    settings?: unknown;
}
interface ModelTransfer {
    readonly name: string;
    readonly transferId: string;
}
interface DownloadEngine {
    configWatchTyped(request: Record<string, never>): AsyncIterable<AssistantAppConfig>;
    agentsWatch(request: {
        meshId: string;
    }): AsyncIterable<unknown>;
    getAgent(request: {
        agentId: string;
        meshId: string;
    }): Promise<{
        modelName?: string | null;
        providerDeviceId?: Buffer | null;
        enabledSkills?: ReadonlyArray<string> | null;
        installedSkills?: ReadonlyArray<string> | null;
        skillsScope?: 'all' | 'selected' | null;
        imageModelChoice?: AgentSkillModelInput['imageModelChoice'];
    } | null>;
    listToolConfigs(request: {
        agentId: string;
        meshId: string;
    }): Promise<{
        configs?: ReadonlyArray<ToolConfigRow> | null;
    }>;
    toolConfigsWatch(request: {
        agentId: string;
        meshId: string;
    }): AsyncIterable<unknown>;
    modelDownloadsWatch(request: Record<string, never>): AsyncIterable<{
        downloads?: ReadonlyArray<{
            name: string;
        }> | null;
    }>;
    setModelDownloadStatus(request: StatusRow & {
        name: string;
    }): Promise<unknown>;
    clearModelDownload(request: {
        name: string;
    }): Promise<unknown>;
    setModelReleased(request: {
        name: string;
        released: boolean;
    }): Promise<AssistantAppConfig>;
    beginModelTransfer(request: {
        name: string;
        transferred?: boolean;
    }): Promise<ModelTransfer>;
    completeModelTransfer(request: {
        name: string;
        transferId: string;
        downloaded?: boolean;
    }): Promise<unknown>;
}
interface ReconcilerOptions {
    engine: DownloadEngine;
    harness: DownloadHarness;
    deviceId: Buffer;
    meshId: () => string | null;
    onCacheChanged: () => void;
    retryMs?: number;
    now?: () => number;
    createScheduler?: (onFire: () => void) => RetryScheduler;
    logger?: LoggerInterface | null;
    mobileClass?: boolean;
}
interface RetryScheduler {
    schedule(deadline: number): void;
    clear(): void;
}
export declare class ModelDownloadReconciler {
    private readonly _engine;
    private readonly _meshId;
    private readonly _harness;
    private readonly _deviceId;
    private readonly _onCacheChanged;
    private readonly _log;
    private readonly _status;
    private readonly _retry;
    private readonly _now;
    private readonly _watchRetryMs;
    private readonly _mobileClass;
    private readonly _scheduler;
    private readonly _attemptGenerations;
    private readonly _transfers;
    private readonly _completedTransfers;
    private readonly _pendingCompletions;
    private readonly _observedTransfers;
    private readonly _observedProgress;
    private readonly _observedSpeed;
    private readonly _requestedModels;
    private readonly _heldLoads;
    private readonly _releasing;
    private readonly _targetTotals;
    private _config;
    private _active;
    private _localLlm;
    private _localSkillModels;
    private _musicChoice;
    private _preemptLlm;
    private _pausedLocalLlm;
    private _capability;
    private readonly _handled;
    private readonly _demands;
    private _dirty;
    private _running;
    private _paused;
    private _runModels;
    private _closed;
    private _configStream;
    private _agentsStream;
    private _toolConfigsStream;
    private _toolConfigsAgentId;
    private readonly _timers;
    constructor({ engine, harness, deviceId, meshId, onCacheChanged, retryMs, now, createScheduler, logger, mobileClass }: ReconcilerOptions);
    start(): void;
    private _reset;
    suspend(): Promise<void>;
    resume(): void;
    meshAdopted(): void;
    yieldToRuns(models: ReadonlyArray<string>): void;
    observeHeldLoad(model: string): void;
    observeDroppedHeldLoad(model: string): void;
    observeImageProgress(observation: ImageDownloadObservation): void;
    private _transfer;
    private _completeTransfer;
    waitUntilCached(model: string, signal: AbortSignal, { onHold }?: CacheWaitOptions): Promise<void>;
    retry(name: string): Promise<void>;
    release<T>(name: string, removeFiles: () => Promise<T>): Promise<T>;
    close(): Promise<void>;
    private _watchConfig;
    private _syncToolConfigsWatch;
    private _swapToolConfigsWatch;
    private _watchToolConfigs;
    private _watchAgents;
    private _restartWatch;
    private _scheduleRestart;
    private _kick;
    private _drain;
    private _step;
    private _writeWaiting;
    private _announceHolds;
    private _flushObservedProgress;
    private _shouldPreempt;
    private _waiting;
    private _nextTarget;
    private _scheduleNextRetry;
    private _desired;
    private _heldBack;
    private _reclaimCached;
    private _modelAvailability;
    private _deviceProfile;
    private _hostCapability;
    private _refreshLocalAgentModels;
    private _adoptLocalModels;
    private _musicModelChoice;
    private _begin;
    private _removeDemandWaiter;
    private _resolveDemand;
    private _failDemand;
    private _attemptGeneration;
    private _stopActive;
    private _download;
}
export declare function musicModelChoiceOf(configs: ReadonlyArray<ToolConfigRow | null>): MusicModelChoice | undefined;
export {};
