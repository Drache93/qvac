import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { ToolExecuteContext } from '../../contract/index.ts';
import { type ParseResult } from '../http-request/request.ts';
export interface HttpRequestAuth {
    type: 'bearer';
    tokenCredentialKey: string;
}
export interface CredentialRecord {
    readonly token: string;
    readonly expiresAt?: number;
}
export type CredentialStoreValue = CredentialRecord | string | null;
export type CredentialStoreFn = (key: string, ctx?: ToolExecuteContext) => Promise<CredentialStoreValue> | CredentialStoreValue;
export declare function credentialRecord(value: CredentialStoreValue): CredentialRecord | null;
export declare function isCredentialExpired(record: CredentialRecord, now?: number): boolean;
export type CredentialAllowList = Record<string, string | string[]>;
export declare function urlAllowed(url: URL, patterns: readonly string[]): boolean;
export declare function isCredentialUrlAllowed(target: string, patterns: readonly string[]): boolean;
export type CredentialAllowListFn = (ctx?: ToolExecuteContext) => CredentialAllowList;
export interface ResolvedCredential {
    readonly token: string;
    readonly key: string;
}
export interface AuthError {
    readonly error: string;
}
export type AuthOutcome = ResolvedCredential | AuthError;
export declare function parseAuth(v: unknown): ParseResult<HttpRequestAuth>;
export declare function resolveAuth(auth: HttpRequestAuth, url: URL, credentialStore: CredentialStoreFn | undefined, credentialAllowList: CredentialAllowList | undefined, ctx: ToolExecuteContext | undefined): Promise<AuthOutcome>;
export declare function resolveAutoAuth(url: URL, credentialStore: CredentialStoreFn | undefined, credentialAllowList: CredentialAllowList | undefined, ctx: ToolExecuteContext | undefined): Promise<AuthOutcome | null>;
export interface BearerHeader {
    readonly header: string | null;
    readonly credentialKey?: string;
}
export type BearerOutcome = BearerHeader | AuthError;
export declare function resolveBearerHeader(auth: HttpRequestAuth | undefined, url: URL, credentialStore: CredentialStoreFn | undefined, credentialAllowList: CredentialAllowList | undefined, ctx: ToolExecuteContext | undefined, signal: BareAbortSignal): Promise<BearerOutcome>;
export declare function resolveRedirectBearerHeader(auth: HttpRequestAuth | undefined, url: URL, credentialStore: CredentialStoreFn | undefined, credentialAllowList: CredentialAllowList | undefined, ctx: ToolExecuteContext | undefined, signal: BareAbortSignal): Promise<BearerHeader>;
