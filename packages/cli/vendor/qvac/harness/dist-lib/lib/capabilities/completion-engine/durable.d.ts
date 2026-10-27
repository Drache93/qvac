import { type RunOutcomeState } from '../../helpers/run-outcome.ts';
import type { RunBackendUse, RunBudget } from '../../contract/index.ts';
import type { PromptUsageChars } from '../usage-breakdown.ts';
import type { CompletionDeps, Session, RuntimeBinding } from './session.ts';
interface CapabilityPolicy {
    behaviorDigest: string;
    roots: string[];
    writeRoots: string[];
    skills: string[];
    skillContent: (readonly [string, string | null])[];
    grantedOps: (readonly [string, string[]])[];
    access?: string;
}
export declare function capabilityPolicy(session: Session): CapabilityPolicy;
export declare function schemaDigest(parameters: object): string;
interface DurableToolFacts {
    name: string;
    description: string;
    prompt: unknown;
    policyVersion: string | null;
    parametersDigest: string;
    toolset: string | null | undefined;
    autoApprove: boolean;
    externalWrite: boolean;
    owningSkill: string | null;
    skillGated: boolean;
    rootsRequired: boolean;
    writeRootsRequired: boolean;
    compiled: boolean;
    defer?: true | undefined;
}
export interface DurableFacts extends Record<string, unknown> {
    bindings: RuntimeBinding[];
    runId: string;
    tools: DurableToolFacts[];
    policy: CapabilityPolicy;
    loadedThisTurn: string[];
    loadedFilesThisTurn: string[];
    loadedSkillFiles: [string, string[]][];
    nudgedSkills: string[];
    backends: RunBackendUse[];
    outcome: RunOutcomeState;
    skillIcon: string | null;
    runBudget: RunBudget;
    startedAt: number;
    runStarted: boolean;
    promptParts: PromptUsageChars | null;
    activation: {
        skillsSelected: boolean;
        enabledSkills: string[];
        mention: string | null;
        loadedSkills: string[];
    };
}
export interface ToolOperationFacts {
    backends: RunBackendUse[];
    runBudget: Pick<RunBudget, 'outputBytesUsed'>;
    outcome: Pick<RunOutcomeState, 'confirmedWrites'>;
}
export declare function captureFacts(session: Session): DurableFacts;
export declare function captureToolOperationFacts(session: Session): ToolOperationFacts;
export declare function restoreFacts(deps: CompletionDeps, facts: DurableFacts): void;
export {};
