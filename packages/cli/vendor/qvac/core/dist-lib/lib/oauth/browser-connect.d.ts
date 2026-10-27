export interface WaitForOAuthCallbackOptions {
    readonly port: number;
    readonly state: string;
    readonly timeoutMs?: number;
    readonly onListening?: () => void;
}
export interface OAuthCallbackCode {
    readonly code: string;
}
export declare function waitForOAuthCallback(opts: WaitForOAuthCallbackOptions): Promise<OAuthCallbackCode>;
