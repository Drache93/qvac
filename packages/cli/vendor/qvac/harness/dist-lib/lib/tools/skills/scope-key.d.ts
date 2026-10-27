import type { SkillReadiness } from '../../contract/index.ts';
export interface CredentialScope {
    readonly agentId?: string | null | undefined;
    readonly skill?: string | null | undefined;
    readonly key: string;
}
export declare function scopeKey({ agentId, skill, key }: CredentialScope): string;
export declare function deviceSharedKeys(readiness: Iterable<SkillReadiness>): Set<string>;
