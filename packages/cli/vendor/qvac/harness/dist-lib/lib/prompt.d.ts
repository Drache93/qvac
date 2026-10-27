import type { Message, SystemPromptParts } from './contract/index.ts';
export declare const RAG_CITATION_LINE = "After your answer, add one final line naming the files you used, written exactly as [Sources: file-a.pdf, file-b.md] - or [Sources: none] if the excerpts did not answer the question. This line is required, it is the only place square brackets belong, and it is removed before the user sees it.";
export declare function currentTimeAnnotation(now?: Date): string;
export declare function lastUserContent(messages: Message[]): string;
export declare function annotateUserTimes<T extends {
    role: string;
    content: string;
    sentAt?: number | undefined;
}>(turns: ReadonlyArray<T>, now?: Date): T[];
export declare function toolGuidelines(name: string): string[];
export interface SystemPromptInput {
    bio?: string | null | undefined;
    toolNames?: ReadonlyArray<string>;
    skillsSection?: string | null;
}
export declare function systemPromptParts({ bio, toolNames, skillsSection }: SystemPromptInput): SystemPromptParts;
export declare function buildSystemPrompt(input: SystemPromptInput): string;
export interface PromptSkill {
    readonly name: string;
    readonly description: string;
}
export declare function skillsPromptSection(activeSkills: ReadonlyArray<PromptSkill>): string | null;
