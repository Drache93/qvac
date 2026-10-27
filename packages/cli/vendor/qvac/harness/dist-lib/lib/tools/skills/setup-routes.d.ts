import type { SkillCatalogEntry } from './catalog.ts';
import type { SkillSetup } from './manifest.ts';
import { type SkillState } from './skill-state.ts';
export declare function deriveSetup(entry: SkillCatalogEntry, state: SkillState): SkillSetup | undefined;
