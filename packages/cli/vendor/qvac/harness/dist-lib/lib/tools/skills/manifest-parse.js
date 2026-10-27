import { isRecord } from '../../guards.js';
export function parseManifestBlock(block, key = 'metadata') {
    const json = extractJsonBlock(block, key);
    if (!isObj(json) || !isObj(json.openclaw)) {
        return {};
    }
    const oc = json.openclaw;
    const requires = readRequires(oc.requires);
    const install = readInstall(oc.install);
    const setup = readSetup(oc.setup);
    return {
        requires,
        install,
        setup,
        env: readEnv(oc.env),
        stub: typeof oc.stub === 'boolean' ? oc.stub : undefined,
        minCapabilityProfile: typeof oc.minCapabilityProfile === 'string' ? oc.minCapabilityProfile : undefined,
        emoji: typeof oc.emoji === 'string' ? oc.emoji : undefined
    };
}
function readEnv(v) {
    if (!isObj(v))
        return undefined;
    const env = {};
    for (const [name, value] of Object.entries(v)) {
        if (typeof value === 'string' && /^[A-Z_][A-Z0-9_]*$/.test(name)) {
            env[name] = value;
        }
    }
    return Object.keys(env).length > 0 ? env : undefined;
}
function extractJsonBlock(block, key) {
    const at = block.indexOf(`${key}:`);
    if (at === -1) {
        return null;
    }
    const rest = block.slice(at + key.length + 1);
    const start = rest.indexOf('{');
    if (start === -1) {
        return null;
    }
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < rest.length; i++) {
        const ch = rest[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            }
            else if (ch === '\\') {
                escaped = true;
            }
            else if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (ch === '"') {
            inString = true;
        }
        else if (ch === '{') {
            depth++;
        }
        else if (ch === '}' && --depth === 0) {
            try {
                return JSON.parse(rest.slice(start, i + 1));
            }
            catch {
                return null;
            }
        }
    }
    return null;
}
function verifyBody(body) {
    if (typeof body === 'string')
        return body;
    return isObj(body) ? JSON.stringify(body) : undefined;
}
function isObj(v) {
    return isRecord(v) && !Array.isArray(v);
}
function strArr(v) {
    if (!Array.isArray(v))
        return undefined;
    return v.filter((x) => typeof x === 'string');
}
function readRequires(v) {
    if (!isObj(v))
        return undefined;
    const bins = strArr(v.bins);
    const mins = readBinMinVersions(v.binMinVersions);
    const credentials = strArr(v.credentials);
    const credentialChecks = readCredentialChecks(v.credentialChecks);
    return bins || mins || credentials || credentialChecks
        ? {
            bins,
            binMinVersions: mins,
            credentials,
            credentialChecks
        }
        : undefined;
}
function readBinMinVersions(v) {
    if (!isObj(v))
        return undefined;
    const out = {};
    for (const [bin, spec] of Object.entries(v)) {
        if (!isObj(spec) || typeof spec.min !== 'string')
            continue;
        out[bin] = {
            min: spec.min,
            command: typeof spec.command === 'string' ? spec.command : undefined
        };
    }
    return Object.keys(out).length > 0 ? out : undefined;
}
function readCredentialChecks(v) {
    if (!isObj(v))
        return undefined;
    const out = {};
    for (const [key, check] of Object.entries(v)) {
        if (!isObj(check) || typeof check.url !== 'string')
            continue;
        const headers = readStringRecord(check.headers);
        out[key] = {
            url: check.url,
            method: typeof check.method === 'string' ? check.method : undefined,
            headers
        };
    }
    return Object.keys(out).length > 0 ? out : undefined;
}
function readStringRecord(v) {
    if (!isObj(v))
        return undefined;
    const out = {};
    for (const [key, value] of Object.entries(v)) {
        if (typeof value === 'string') {
            out[key] = value;
        }
    }
    return Object.keys(out).length > 0 ? out : undefined;
}
export function readInstall(v) {
    if (!Array.isArray(v))
        return undefined;
    const steps = [];
    for (const raw of v) {
        if (!isObj(raw) ||
            typeof raw.id !== 'string' ||
            typeof raw.kind !== 'string' ||
            typeof raw.label !== 'string') {
            continue;
        }
        const bins = strArr(raw.bins);
        steps.push({
            id: raw.id,
            kind: raw.kind,
            label: raw.label,
            formula: typeof raw.formula === 'string' ? raw.formula : undefined,
            bins,
            command: typeof raw.command === 'string' ? raw.command : undefined,
            manual: typeof raw.manual === 'boolean' ? raw.manual : undefined
        });
    }
    return steps.length > 0 ? steps : undefined;
}
const ROUTE_KINDS = new Set(['oauth', 'token', 'install', 'picker', 'instructions']);
function isRouteKind(v) {
    return typeof v === 'string' && ROUTE_KINDS.has(v);
}
export function readSetup(v) {
    if (!isObj(v))
        return undefined;
    const summary = typeof v.summary === 'string' ? v.summary : undefined;
    const routes = readRoutes(v.routes);
    return summary || routes ? { summary: summary || undefined, routes } : undefined;
}
function readRoutes(v) {
    if (!Array.isArray(v))
        return undefined;
    const routes = [];
    for (const raw of v) {
        if (!isObj(raw) || !isRouteKind(raw.kind) || typeof raw.label !== 'string') {
            continue;
        }
        const steps = strArr(raw.steps);
        const configSteps = strArr(raw.configSteps);
        const fields = readFields(raw.fields);
        const oauth = readOAuth(raw.oauth);
        if (raw.kind === 'oauth' && !oauth) {
            continue;
        }
        routes.push({
            kind: raw.kind,
            label: raw.label,
            provider: typeof raw.provider === 'string' ? raw.provider : undefined,
            credentialKey: typeof raw.credentialKey === 'string' ? raw.credentialKey : undefined,
            description: typeof raw.description === 'string' ? raw.description : undefined,
            helpUrl: typeof raw.helpUrl === 'string' ? raw.helpUrl : undefined,
            steps,
            configSteps,
            fields,
            satisfied: typeof raw.satisfied === 'boolean' ? raw.satisfied : undefined,
            oauth
        });
    }
    return routes.length > 0 ? routes : undefined;
}
const OAUTH_TOKEN_AUTH = new Set(['pkce-only', 'secret-in-body', 'secret-in-basic']);
const OAUTH_RESERVED_PARAMS = new Set([
    'client_id',
    'client_secret',
    'redirect_uri',
    'response_type',
    'state',
    'scope',
    'code_challenge',
    'code_challenge_method'
]);
function isOAuthTokenAuth(v) {
    return typeof v === 'string' && OAUTH_TOKEN_AUTH.has(v);
}
function httpsUrl(v) {
    if (typeof v !== 'string' || v.length === 0)
        return undefined;
    try {
        return new URL(v).protocol === 'https:' ? v : undefined;
    }
    catch {
        return undefined;
    }
}
function isPort(v) {
    return typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 65536;
}
function readAuthParams(v) {
    const raw = Array.isArray(v)
        ? Object.fromEntries(v.flatMap((pair) => isObj(pair) && typeof pair.key === 'string' && typeof pair.value === 'string'
            ? [[pair.key, pair.value]]
            : []))
        : v;
    const record = readStringRecord(raw);
    if (!record) {
        return undefined;
    }
    const out = Object.fromEntries(Object.entries(record).filter(([key]) => !OAUTH_RESERVED_PARAMS.has(key)));
    return Object.keys(out).length > 0 ? out : undefined;
}
const OAUTH_ERROR_CODE = /^[a-z0-9_]+$/;
function siteOf(url) {
    return new URL(url).hostname.split('.').slice(-2).join('.');
}
function readVerifyRule(v) {
    if (!isObj(v) || typeof v.error !== 'string' || !OAUTH_ERROR_CODE.test(v.error)) {
        return undefined;
    }
    const status = Array.isArray(v.status)
        ? v.status.filter((s) => Number.isInteger(s) && s >= 100 && s < 600)
        : [];
    const field = typeof v.field === 'string' && v.field.length > 0 ? v.field : undefined;
    if (status.length === 0 && !field) {
        return undefined;
    }
    return {
        error: v.error,
        status: status.length > 0 ? status : undefined,
        field,
        notEqual: field && typeof v.notEqual === 'string' ? v.notEqual : undefined
    };
}
function readVerify(v, tokenUrl) {
    if (!isObj(v))
        return undefined;
    const url = httpsUrl(v.url);
    if (!url || siteOf(url) !== siteOf(tokenUrl)) {
        return undefined;
    }
    if (v.method !== undefined && v.method !== null && v.method !== 'GET' && v.method !== 'POST') {
        return undefined;
    }
    const reject = Array.isArray(v.reject) ? v.reject.flatMap((r) => readVerifyRule(r) ?? []) : [];
    if (reject.length === 0) {
        return undefined;
    }
    const body = verifyBody(v.body);
    return {
        url,
        method: v.method === 'GET' || v.method === 'POST' ? v.method : undefined,
        body,
        reject
    };
}
function readOAuth(v) {
    if (!isObj(v))
        return undefined;
    const authUrl = httpsUrl(v.authUrl);
    const tokenUrl = httpsUrl(v.tokenUrl);
    if (typeof v.stateKey !== 'string' ||
        v.stateKey.length === 0 ||
        !authUrl ||
        !tokenUrl ||
        !isOAuthTokenAuth(v.tokenAuth)) {
        return undefined;
    }
    const scopes = v.scopes === undefined || v.scopes === null ? [] : strArr(v.scopes);
    if (!scopes) {
        return undefined;
    }
    const extraAuthParams = readAuthParams(v.extraAuthParams);
    const registrationEndpoint = httpsUrl(v.registrationEndpoint);
    const verify = readVerify(v.verify, tokenUrl);
    return {
        stateKey: v.stateKey,
        authUrl,
        tokenUrl,
        scopes,
        tokenAuth: v.tokenAuth,
        extraAuthParams,
        registrationEndpoint,
        port: isPort(v.port) ? v.port : undefined,
        sharedIosSession: typeof v.sharedIosSession === 'boolean' ? v.sharedIosSession : undefined,
        verify
    };
}
export function toWireSetup(setup) {
    if (!setup?.routes)
        return setup;
    return {
        ...setup,
        routes: setup.routes.map((route) => route.oauth?.extraAuthParams
            ? {
                ...route,
                oauth: {
                    ...route.oauth,
                    extraAuthParams: Object.entries(route.oauth.extraAuthParams).map(([key, value]) => ({
                        key,
                        value
                    }))
                }
            }
            : route)
    };
}
function readFields(v) {
    if (!Array.isArray(v))
        return undefined;
    const fields = [];
    for (const raw of v) {
        if (!isObj(raw) || typeof raw.key !== 'string' || typeof raw.label !== 'string') {
            continue;
        }
        fields.push({
            key: raw.key,
            label: raw.label,
            placeholder: typeof raw.placeholder === 'string' ? raw.placeholder : undefined,
            secret: typeof raw.secret === 'boolean' ? raw.secret : undefined,
            required: typeof raw.required === 'boolean' ? raw.required : undefined
        });
    }
    return fields.length > 0 ? fields : undefined;
}
