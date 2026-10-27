import type { SkillCatalogEntry } from '../../tools/skills/catalog.ts';
import type { HarnessHook, HookContext, HookResult } from '../../contract/index.ts';
type SkillCatalogInput = readonly SkillCatalogEntry[] | (() => readonly SkillCatalogEntry[] | readonly string[]);
export declare class SkillCatalogGuardHook implements HarnessHook {
    readonly name = "skill-catalog";
    readonly phase: 'preToolCall';
    private readonly _catalog;
    constructor(catalog?: SkillCatalogInput);
    run(ctx: HookContext): HookResult;
}
export {};
