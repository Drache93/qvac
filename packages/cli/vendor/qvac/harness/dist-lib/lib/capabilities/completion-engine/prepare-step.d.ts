import type { ResolvedAgent, ToolCallDisplay } from '../../contract/index.ts';
import type { CompletionSkillEntry } from '../skill-entry.ts';
import type { CompletionContext } from '../../machine/index.ts';
import type { PrepareFailure, PrepareRunOutput, PrepareStep, PrepareStepProposal } from './stages.ts';
import type { CompletionDeps } from './session.ts';
export type PrepareCall = Pick<PrepareStepProposal, 'id' | 'tool' | 'args' | 'done'>;
export interface PrepareSettleInput {
    deps: CompletionDeps;
    context: CompletionContext;
    step: PrepareStep;
    result: unknown;
    announce(): void;
}
export interface PrepareFailInput {
    deps: CompletionDeps;
    context: CompletionContext;
    step: PrepareStep;
    error: string;
}
export interface PrepareStepSource {
    readonly label: string;
    propose(deps: CompletionDeps, agent: ResolvedAgent<CompletionSkillEntry>): PrepareCall | null;
    display(deps: CompletionDeps, step: PrepareStep): ToolCallDisplay;
    settle(input: PrepareSettleInput): PrepareRunOutput;
    fail(input: PrepareFailInput): PrepareFailure;
}
