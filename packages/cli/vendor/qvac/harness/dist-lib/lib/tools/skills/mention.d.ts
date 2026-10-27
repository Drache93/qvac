import type { SkillCatalogEntry } from './catalog.ts';
import { skillMentionHandle, skillMentionName } from './mention-name.ts';
export { skillMentionHandle, skillMentionName };
export declare function resolveSkillMention<Skill extends SkillCatalogEntry>(text: string, catalog: readonly Skill[]): Skill | null;
export declare function resolveImplicitSkill(text: string, activeSkills: readonly SkillCatalogEntry[]): SkillCatalogEntry | null;
