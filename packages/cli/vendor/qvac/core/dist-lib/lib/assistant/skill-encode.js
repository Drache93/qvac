import { normalizeSkillSetup } from '@qvac/harness';
const TOKEN_AUTH = ['pkce-only', 'secret-in-body', 'secret-in-basic'];
export function toEngineSkill(skill) {
    const setup = normalizeSkillSetup(skill.setup);
    return {
        name: skill.name,
        displayName: skill.displayName,
        description: skill.description,
        tools: [...skill.tools],
        credentials: [...skill.credentials],
        allowList: [...skill.allowList],
        platforms: [...skill.platform],
        status: skill.status,
        requirements: skill.requires ? toEngineSkillRequirements(skill.requires) : undefined,
        install: skill.install?.map(toEngineInstallStep),
        setup: setup ? toEngineSkillSetup(setup) : undefined,
        stub: skill.stub,
        minCapabilityProfile: skill.minCapabilityProfile,
        emoji: skill.emoji
    };
}
export function toEngineSkillRequirements(requires) {
    return {
        binaries: (requires.bins ?? []).map((bin) => ({
            bin,
            minVersion: requires.binMinVersions?.[bin]?.min,
            command: requires.binMinVersions?.[bin]?.command
        })),
        credentials: [...(requires.credentials ?? [])]
    };
}
export function toEngineInstallStep(step) {
    return {
        id: step.id,
        kind: step.kind,
        label: step.label,
        formula: step.formula,
        command: step.command,
        manual: step.manual,
        bins: step.bins && [...step.bins]
    };
}
export function toEngineSkillSetup(setup) {
    return {
        summary: setup.summary,
        routes: setup.routes?.map(toEngineRoute)
    };
}
function toEngineRoute(route) {
    return {
        kind: route.kind,
        label: route.label,
        provider: route.provider,
        credentialKey: route.credentialKey,
        description: route.description,
        helpUrl: route.helpUrl,
        steps: route.steps && [...route.steps],
        configSteps: route.configSteps && [...route.configSteps],
        fields: route.fields?.map((field) => ({
            key: field.key,
            label: field.label,
            placeholder: field.placeholder,
            secret: field.secret,
            required: field.required
        })),
        satisfied: route.satisfied,
        oauth: toEngineOauth(route.oauth)
    };
}
function toEngineOauth(oauth) {
    if (!oauth?.stateKey || !oauth.authUrl || !oauth.tokenUrl)
        return undefined;
    const tokenAuth = TOKEN_AUTH.find((mode) => mode === oauth.tokenAuth);
    if (!tokenAuth) {
        return undefined;
    }
    return {
        stateKey: oauth.stateKey,
        authUrl: oauth.authUrl,
        tokenUrl: oauth.tokenUrl,
        tokenAuth,
        scopes: [...(oauth.scopes ?? [])],
        extraAuthParams: oauth.extraAuthParams,
        registrationEndpoint: oauth.registrationEndpoint,
        port: oauth.port,
        sharedIosSession: oauth.sharedIosSession
    };
}
