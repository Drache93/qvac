import type { OAuthRedirectFactory } from './redirect-types.ts';
export type OAuthProvider = string;
export interface OAuthTokens {
    readonly accessToken: string;
    readonly refreshToken?: string;
    readonly expiresAt?: number;
    readonly scope?: string;
}
export type OAuthFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export interface OAuthRuntime {
    readonly fetch: OAuthFetch;
    readonly randomBase64Url: (size: number) => string;
    readonly sha256Base64Url: (value: string) => string | Promise<string>;
}
export interface OAuthCredentials {
    readonly clientId: string;
    readonly clientSecret?: string;
}
interface OAuthProviderConfigBase {
    readonly clientId: string;
    readonly authUrl: string;
    readonly tokenUrl: string;
    readonly scopes: ReadonlyArray<string>;
    readonly credentialKey: string;
    readonly port: number;
    readonly extraAuthParams?: Readonly<Record<string, string>>;
    readonly dynamicRegistration?: boolean;
    readonly registrationEndpoint?: string;
}
export type OAuthFlowStage = 'awaiting-callback' | 'exchanging-code';
export interface OAuthFlowDeps {
    readonly openUrl?: (url: string) => Promise<void>;
    readonly timeoutMs?: number;
    readonly requestTimeoutMs?: number;
    readonly getClientId?: () => Promise<string | undefined>;
    readonly saveClientId?: (clientId: string) => Promise<void>;
    readonly clearClientId?: () => Promise<void>;
    readonly createRedirect?: OAuthRedirectFactory;
    readonly onStage?: (stage: OAuthFlowStage) => void;
}
export type PkceOnlyProviderConfig = OAuthProviderConfigBase & {
    readonly tokenAuth: 'pkce-only';
};
export type SecretInBodyProviderConfig = OAuthProviderConfigBase & {
    readonly tokenAuth: 'secret-in-body';
    readonly clientSecret: string;
};
export type SecretInBasicProviderConfig = OAuthProviderConfigBase & {
    readonly tokenAuth: 'secret-in-basic';
    readonly clientSecret: string;
};
export type OAuthProviderConfig = PkceOnlyProviderConfig | SecretInBodyProviderConfig | SecretInBasicProviderConfig;
export interface OAuthFlowResult {
    readonly config: OAuthProviderConfig;
    readonly tokens: OAuthTokens;
}
export {};
