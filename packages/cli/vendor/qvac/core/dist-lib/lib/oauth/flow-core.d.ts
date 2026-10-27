import type { OAuthRedirectFactory } from './redirect-types.ts';
import type { OAuthFlowDeps, OAuthProviderConfig, OAuthRuntime, OAuthTokens } from './types.ts';
export type OAuthRuntimeFlowDeps = OAuthFlowDeps & {
    readonly createRedirect: OAuthRedirectFactory;
};
export declare function runOAuthFlowWithRuntime(config: OAuthProviderConfig, deps: OAuthRuntimeFlowDeps, runtime: OAuthRuntime): Promise<OAuthTokens>;
