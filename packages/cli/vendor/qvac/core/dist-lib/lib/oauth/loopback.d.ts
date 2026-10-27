import type { OAuthLoopbackServer, OAuthLoopbackTarget } from './redirect-types.ts';
export declare function abortOAuthLoopback(credentialKey: string): Promise<boolean>;
export declare function deliverOAuthCallback(address: string): boolean;
export declare function openOAuthLoopback(port: number, target: OAuthLoopbackTarget): Promise<OAuthLoopbackServer>;
