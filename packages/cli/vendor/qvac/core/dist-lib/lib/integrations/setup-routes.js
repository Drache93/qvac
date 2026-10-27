import { OBSIDIAN_VAULT_PATH_CREDENTIAL_KEY } from '../obsidian-key.js';
import { MCP_TOKEN_PROVIDERS } from './mcp-providers.js';
const UNSUPPORTED_STATE = 'unsupported';
export const SETUP_ROUTE_KIND = {
    oauth: 'oauth',
    token: 'token',
    install: 'install',
    picker: 'picker',
    instructions: 'instructions'
};
const OBSIDIAN_SKILL_NAME = 'obsidian';
const OBSIDIAN_VAULT_PICKER = {
    kind: SETUP_ROUTE_KIND.picker,
    label: 'Select a vault folder',
    provider: OBSIDIAN_SKILL_NAME,
    credentialKey: OBSIDIAN_VAULT_PATH_CREDENTIAL_KEY,
    description: "Pick the vault's top-level folder — the one containing its `.obsidian` settings folder, which marks it a valid Obsidian vault. Workbench then reads and writes that folder's Markdown files directly instead of using the Obsidian CLI; app-only actions (open, plugins, sync) still need the CLI and are unavailable while a folder is set. Disconnect to restore CLI mode."
};
export function deriveSetupRoutes(entry, options = {}) {
    const base = entry.metadata.setup ?? { routes: derivedRoutes(entry) };
    if (entry.metadata.name === OBSIDIAN_SKILL_NAME) {
        return appendVaultPicker(base, options.sandboxed === true);
    }
    return base;
}
function appendVaultPicker(setup, preferPicker) {
    const routes = setup.routes ?? [];
    if (routes.some((route) => route.kind === SETUP_ROUTE_KIND.picker)) {
        return preferPicker ? prioritizeVaultPicker(setup) : setup;
    }
    const next = preferPicker
        ? [OBSIDIAN_VAULT_PICKER, ...routes]
        : [...routes, OBSIDIAN_VAULT_PICKER];
    return { ...setup, routes: next };
}
function prioritizeVaultPicker(setup) {
    const routes = setup.routes ?? [];
    const picker = routes.find((route) => route.kind === SETUP_ROUTE_KIND.picker);
    if (!picker || routes[0]?.kind === SETUP_ROUTE_KIND.picker) {
        return setup;
    }
    return {
        ...setup,
        routes: [picker, ...routes.filter((route) => route.kind !== SETUP_ROUTE_KIND.picker)]
    };
}
function derivedRoutes(entry) {
    const routes = [];
    for (const key of credentialKeysFor(entry)) {
        const route = credentialRoute(key);
        if (route) {
            routes.push(route);
        }
    }
    const install = installRoute(entry);
    if (install) {
        routes.push(install);
    }
    return routes;
}
function credentialKeysFor(entry) {
    const transports = entry.metadata.transports ?? [];
    if (transports.length > 0) {
        return transports.map((transport) => transport.credentialKey);
    }
    return entry.metadata.requires?.credentials ?? [];
}
function credentialRoute(credentialKey) {
    const token = MCP_TOKEN_PROVIDERS.find((config) => config.credentialKey === credentialKey);
    if (token) {
        return {
            kind: SETUP_ROUTE_KIND.token,
            label: `Connect ${token.label}`,
            provider: token.provider,
            credentialKey,
            description: token.description,
            helpUrl: token.tokenHelpUrl,
            steps: token.guide,
            fields: [{ key: credentialKey, label: token.label, secret: true, required: true }]
        };
    }
    return null;
}
function installRoute(entry) {
    const steps = entry.metadata.install ?? [];
    if (steps.length === 0 || entry.state === UNSUPPORTED_STATE) {
        return null;
    }
    const step = steps[0];
    if (!step) {
        return null;
    }
    return {
        kind: SETUP_ROUTE_KIND.install,
        label: step.label,
        description: step.formula ? `Installs \`${step.formula}\`.` : undefined,
        satisfied: entry.available
    };
}
