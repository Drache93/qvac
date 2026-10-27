import type { CredentialStoreFn } from '../tools/skills/auth-resolver.ts';
import type { SkillState } from '../tools/skills/skill-state-constants.ts';
export interface SkillReadinessContext {
    readonly platform: string | undefined;
    readonly agentId: string | null | undefined;
    readonly credentialStore: CredentialStoreFn | undefined;
    readonly missingBins: readonly string[];
}
export interface SkillReadiness {
    readonly skill: string;
    state(ctx: SkillReadinessContext): Promise<SkillState | null> | SkillState | null;
    readonly probeVersions?: false;
    readonly deviceSharedKeys?: readonly string[];
}
