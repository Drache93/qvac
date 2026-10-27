import type { EngineFacts } from './stages.ts';
import { type CompletionDeps } from './session.ts';
import type { CompletionActorOutputs, CompletionContext, EngineEvent, Stage } from '../../machine/index.ts';
export interface Invocation {
    context: CompletionContext;
    signal: AbortSignal;
    stage: string;
    emit(event: EngineEvent): void;
    commit(facts: EngineFacts): void;
    commitSettledResult(operationId: string): void;
}
export interface EnginePorts {
    stages: {
        [S in Stage]: (cx: Invocation) => Promise<CompletionActorOutputs[S]>;
    };
    rebuild(cx: Invocation): Promise<void>;
    lifecycle(phase: 'runPause' | 'runResume', context: CompletionContext): Promise<void>;
    settledResultFacts?(operationId: string, current: EngineFacts | null): EngineFacts | undefined;
    now(): number;
}
export interface InvokeTracker {
    trackInvoke(): () => void;
    waitForInvokes(): Promise<void>;
    drainTimedOut(): Promise<boolean>;
}
export declare function completionPorts(deps: CompletionDeps): EnginePorts;
