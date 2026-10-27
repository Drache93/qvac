import type { SkillEntry, SkillSetup } from '../skill-types.ts';
export declare const SETUP_ROUTE_KIND: {
    readonly oauth: 'oauth';
    readonly token: 'token';
    readonly install: 'install';
    readonly picker: 'picker';
    readonly instructions: 'instructions';
};
export interface DeriveSetupOptions {
    readonly sandboxed?: boolean;
}
export declare function deriveSetupRoutes(entry: SkillEntry, options?: DeriveSetupOptions): SkillSetup;
