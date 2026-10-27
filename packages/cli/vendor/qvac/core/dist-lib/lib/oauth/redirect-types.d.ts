export interface OAuthCallbackResult {
    readonly code: string;
    readonly state: string;
}
export interface OAuthLoopbackTarget {
    readonly credentialKey: string;
    readonly state: string;
    readonly returnTo?: string;
}
export interface OAuthLoopbackServer {
    readonly redirectUri: string;
    readonly waitForCode: (timeoutMs?: number) => Promise<OAuthCallbackResult>;
    readonly close: () => void;
}
export interface OAuthRedirect {
    readonly redirectUri: string;
    readonly authorize: (authUrl: string, timeoutMs?: number, expectedState?: string) => Promise<OAuthCallbackResult>;
    readonly close: () => void;
}
export type OAuthRedirectFactory = (target: {
    readonly port: number;
    readonly credentialKey: string;
    readonly state: string;
}, deps: {
    readonly openUrl: (url: string) => Promise<void>;
}) => Promise<OAuthRedirect>;
