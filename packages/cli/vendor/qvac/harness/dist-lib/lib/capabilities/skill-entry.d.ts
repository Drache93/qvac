import type { SkillCatalogEntry } from '../tools/skills/catalog.ts';
import { type SkillState } from '../tools/skills/skill-state-constants.ts';
export type CompletionSkillEntry = SkillCatalogEntry & {
    readonly status?: SkillState;
};
export declare function skillInContext(entry: CompletionSkillEntry): boolean;
export declare function unreadySkillState(name: string, catalog: readonly CompletionSkillEntry[]): SkillState | null;
export declare function unreadySkillMessage(name: string, state: string): string;
