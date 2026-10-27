import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import { type CredentialStoreFn } from './auth-resolver.ts';
import type { SkillCatalogEntry } from './catalog.ts';
export declare const CREDENTIAL_CHECK_TTL_MS = 45000;
interface CredentialCheckResponse {
    readonly status: number;
    text?: () => Promise<string>;
}
export type CredentialCheckFetch = (input: string, init: {
    method: string;
    headers: Headers;
    signal: BareAbortSignal;
}) => Promise<CredentialCheckResponse>;
export interface ValidateCredentialChecksOptions {
    credentialStore?: CredentialStoreFn;
    agentId?: string | null;
    fetchImpl?: CredentialCheckFetch;
    refresh?: boolean | undefined;
    now?: () => number;
    ttlMs?: number;
}
export declare function validateCredentialChecks(catalog: readonly SkillCatalogEntry[], { credentialStore, agentId, fetchImpl, refresh, now, ttlMs }?: ValidateCredentialChecksOptions): Promise<void>;
export {};
