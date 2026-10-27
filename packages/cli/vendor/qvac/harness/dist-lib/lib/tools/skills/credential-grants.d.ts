import type { CredentialAllowList, CredentialAllowListFn } from './auth-resolver.ts';
import { type CredentialSlotSource } from './credential-slots.ts';
export interface CredentialGrantEntry extends CredentialSlotSource {
    readonly name: string;
    readonly allowList: readonly string[];
    readonly origin?: 'overlay';
}
export declare function credentialGrants(catalog: readonly CredentialGrantEntry[], skills: readonly string[] | undefined): CredentialAllowList;
export declare function credentialAllowListFor(catalog: readonly CredentialGrantEntry[]): CredentialAllowListFn;
