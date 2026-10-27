import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { CompletionArgs } from '../capabilities/completion-engine/index.ts';
import type { CompletionSdk, RoundModelLease, ToolDefinition } from '../contract/index.ts';
import type { CompletionContext } from '../../index.ts';
import type { CompletionSkillEntry } from '../capabilities/skill-entry.ts';
import { type LlmDeviceConfig, type ModelLoadOptions, type ModelLifecycleSdk, type PoolLike } from '../models/model-pool.ts';
export type CompletionRuntimeRequest = CompletionContext & {
    ctxSize?: number;
};
interface RuntimeLease {
    modelId: string;
    ctxSize?: number | undefined;
    slots?: number | undefined;
    release(): void;
}
interface RuntimeAcquireOptions {
    pool: PoolLike;
    key: string;
    open(): ReturnType<PoolLike['open']>;
    signal?: BareAbortSignal;
    prepare: () => Promise<boolean>;
}
interface RuntimeGate {
    readonly suspended: boolean;
    readonly draining: boolean;
    assertNotClosing(): void;
}
interface RuntimeResidency {
    readonly pool: PoolLike;
    readonly gate: RuntimeGate;
    readonly sdk: {
        load(): Promise<CompletionSdk>;
    };
    tools(): readonly ToolDefinition[];
    skills(agentId: string | null, model: string): Promise<CompletionSkillEntry[]>;
    unloadIdleGenerators(): Promise<void>;
    loadOptions(model: string, agent?: CompletionContext['agent']): ModelLoadOptions;
    deviceConfig(): LlmDeviceConfig;
    acquireLease(options: RuntimeAcquireOptions): Promise<RuntimeLease | null>;
    makeRoomForCompletion(model: string, options: {
        loadOpts: ModelLoadOptions;
        signal?: BareAbortSignal;
    }): Promise<boolean>;
    loadLifecycleSdk(): Promise<ModelLifecycleSdk>;
}
export type RoundResidency = Pick<RuntimeResidency, 'pool' | 'gate' | 'sdk' | 'acquireLease' | 'makeRoomForCompletion' | 'unloadIdleGenerators'>;
interface RoundTarget {
    model: string;
    key: string;
    loadOpts: ModelLoadOptions;
    signal?: BareAbortSignal | undefined;
}
export interface PreparedRuntime {
    key: string;
    args: Partial<CompletionArgs> & {
        acquireRound: NonNullable<CompletionArgs['acquireRound']>;
    };
}
export declare function prepareCompletionRuntime(residency: RuntimeResidency, request: CompletionRuntimeRequest): Promise<PreparedRuntime>;
export declare function roundAcquirer(residency: RoundResidency, { model, key, loadOpts, signal }: RoundTarget): (invocationSignal?: BareAbortSignal) => Promise<RoundModelLease>;
export {};
