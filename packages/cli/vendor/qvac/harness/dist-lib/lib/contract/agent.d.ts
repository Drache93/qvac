import type { LlmGenerationParams } from '../models/llm-presets.ts';
import type { DriveRoot } from '../tools/fs/scope.ts';
import type { CliValidator } from '../tools/skills/cli-schema-types.ts';
import type { AgentConfig, ResponseFormat, ToolDefinition } from './completion.ts';
import type { CompiledPolicy } from './policy.ts';
import type { Message } from './run.ts';
export type { LlmGenerationParams };
export interface AgentSkill {
    readonly name: string;
    readonly description: string;
    readonly tools: readonly string[];
    readonly cliValidator?: CliValidator;
}
export interface SystemPromptParts {
    text: string;
    bioChars: number;
    skillsChars: number;
}
export interface SkillActivation {
    skillsSelected: boolean;
    enabledSkills: ReadonlyArray<string>;
    mention: string | null;
    loadedSkills: ReadonlySet<string>;
}
export interface AgentPolicy {
    readonly skipApprovals: boolean;
}
export interface AgentPorts<Skill extends AgentSkill = AgentSkill> {
    generationParams(model: string | undefined, reasoning: boolean | undefined, thinking: boolean | undefined): LlmGenerationParams | undefined;
    systemPrompt(input: {
        bio: string | null | undefined;
        toolNames: readonly string[];
        skills: readonly Skill[];
    }): SystemPromptParts;
    mention(text: string, skills: readonly Skill[]): Skill | null;
    implicitSkill(text: string, skills: readonly Skill[]): Skill | null;
}
export interface AgentRequest<Skill extends AgentSkill = AgentSkill> {
    readonly agent: AgentConfig | undefined;
    readonly model: string | undefined;
    readonly capabilityProfile?: string | undefined;
    readonly thinkingDefault?: string | undefined;
    readonly generationParams?: LlmGenerationParams | undefined;
    readonly responseFormat?: ResponseFormat | undefined;
    readonly messages: readonly Message[];
    readonly userText: string;
    readonly tools: readonly ToolDefinition[];
    readonly skills: readonly Skill[];
    readonly loadedSkills: ReadonlySet<string>;
    readonly fsRoots: readonly DriveRoot[];
    readonly fsWriteRoots: readonly DriveRoot[];
    readonly planning?: boolean;
    readonly planMode?: boolean;
    readonly policy?: CompiledPolicy;
}
export interface ResolvedAgent<Skill extends AgentSkill = AgentSkill> {
    readonly enabled: ToolDefinition[];
    readonly system: SystemPromptParts;
    readonly activation: SkillActivation;
    readonly activeSkills: Skill[];
    readonly mention: Skill | null;
    readonly preload: Skill | null;
    readonly grantedOps: Map<string, CliValidator[]>;
    readonly writableRoots: DriveRoot[];
    readonly generationParams: LlmGenerationParams | undefined;
    readonly policy: AgentPolicy;
    select(loadedSkills: ReadonlySet<string>): ToolDefinition[];
    systemFor(loadedSkills: ReadonlySet<string>): SystemPromptParts;
}
