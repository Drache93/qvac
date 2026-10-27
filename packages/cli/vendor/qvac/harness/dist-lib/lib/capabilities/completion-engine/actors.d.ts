import type { RunLog } from '../../run-log/index.ts';
import type { EnginePorts, InvokeTracker } from './ports.ts';
import type { CompletionActorLogic, EngineEvent } from '../../machine/index.ts';
export interface EngineDeps {
    ports: EnginePorts;
    journal: RunLog;
    invokes: InvokeTracker;
    emitContent?(event: EngineEvent): void;
}
export declare function createInvokeTracker(): InvokeTracker;
export declare function createCompletionActors(deps: EngineDeps): CompletionActorLogic;
