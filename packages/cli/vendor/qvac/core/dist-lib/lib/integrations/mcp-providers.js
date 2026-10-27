const GITHUB_CONFIG = {
    provider: 'github',
    credentialKey: 'github_access_token',
    label: 'GitHub',
    description: 'Repos, pull requests, issues, and workflow runs — Personal Access Token',
    tokenHelpUrl: 'https://github.com/settings/tokens',
    guide: [
        'Create a personal access token (classic) at https://github.com/settings/tokens — scopes: repo and read:org. Classic tokens work everywhere; fine-grained ones need per-org enablement.',
        'Paste it above and click Save.',
        'For organizations enforcing SAML SSO, authorize the token for the org after creating it.'
    ]
};
const REGISTRY = {
    github: GITHUB_CONFIG
};
export const MCP_TOKEN_PROVIDERS = Object.values(REGISTRY);
export function isMcpTokenProvider(value) {
    return typeof value === 'string' && Object.hasOwn(REGISTRY, value);
}
export function resolveMcpProvider(provider) {
    return REGISTRY[provider];
}
