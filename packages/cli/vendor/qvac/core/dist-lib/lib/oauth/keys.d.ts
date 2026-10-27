import type { SkillOAuthConfig } from '@qvac/harness';
export declare function scopedKey(agentId: string | undefined, key: string): string;
export type OAuthKeySpec = SkillOAuthConfig & {
    readonly credentialKey: string;
    readonly provider: string;
};
interface OAuthConfigLike {
    readonly stateKey?: string | null | undefined;
    readonly authUrl?: string | null | undefined;
    readonly tokenUrl?: string | null | undefined;
    readonly scopes?: ReadonlyArray<string> | null | undefined;
    readonly tokenAuth?: string | null | undefined;
    readonly extraAuthParams?: unknown;
    readonly registrationEndpoint?: string | null | undefined;
    readonly port?: number | null | undefined;
    readonly sharedIosSession?: boolean | null | undefined;
}
export interface OAuthRouteLike {
    readonly credentialKey?: string | null | undefined;
    readonly provider?: string | null | undefined;
    readonly oauth?: OAuthConfigLike | null | undefined;
}
export declare function specFromRoute(route: OAuthRouteLike): OAuthKeySpec | null;
export declare const OAUTH_CALLBACK_PATH = "/callback";
export declare const OAUTH_WAIT_FOR_CODE_TIMEOUT_MS = 120000;
export declare function oauthRedirectUri(port: number): string;
export {};
