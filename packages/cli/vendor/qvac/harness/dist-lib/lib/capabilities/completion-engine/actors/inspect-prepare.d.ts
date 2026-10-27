import type { PrepareStepSource } from '../prepare-step.ts';
import type { CompletionActor } from '../session.ts';
import type { PrepareInspectionOutput } from '../stages.ts';
export declare function inspectPrepare(source: PrepareStepSource): CompletionActor<PrepareInspectionOutput>;
