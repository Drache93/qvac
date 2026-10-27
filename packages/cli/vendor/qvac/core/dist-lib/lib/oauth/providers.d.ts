import type { OAuthKeySpec } from './keys.ts';
import type { OAuthCredentials, OAuthProviderConfig } from './types.ts';
export declare function buildProviderConfig(spec: OAuthKeySpec, credentials: OAuthCredentials): OAuthProviderConfig;
