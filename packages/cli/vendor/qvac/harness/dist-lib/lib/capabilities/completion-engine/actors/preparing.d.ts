import type { PrepareStepSource } from '../prepare-step.ts';
import type { CompletionActor } from '../session.ts';
import type { PreparingOutput } from '../stages.ts';
export declare function preparing(source: PrepareStepSource): CompletionActor<PreparingOutput>;
