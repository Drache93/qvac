import type { PkceChallenge } from './pkce.ts';
import type { OAuthRuntime } from './types.ts';
export declare function generateRuntimePkceChallenge(runtime: OAuthRuntime): Promise<PkceChallenge>;
