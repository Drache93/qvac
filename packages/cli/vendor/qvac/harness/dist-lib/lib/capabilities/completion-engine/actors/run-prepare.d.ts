import type { PrepareStepSource } from '../prepare-step.ts';
import type { CompletionActor } from '../session.ts';
import type { PrepareRunOutput } from '../stages.ts';
export declare function runPrepare(source: PrepareStepSource): CompletionActor<PrepareRunOutput>;
