import { specFromRoute } from './keys.js';
export function oauthSpecs(skills) {
    const byKey = new Map();
    for (const skill of skills) {
        if (skill.origin === 'overlay')
            continue;
        for (const route of skill.setup?.routes ?? []) {
            const spec = specFromRoute(route);
            if (spec && !byKey.has(spec.credentialKey)) {
                byKey.set(spec.credentialKey, spec);
            }
        }
    }
    const claimed = new Set();
    const specs = [];
    for (const spec of byKey.values()) {
        if (byKey.has(spec.stateKey) || claimed.has(spec.stateKey))
            continue;
        claimed.add(spec.stateKey);
        specs.push(spec);
    }
    return specs;
}
export function oauthSpecFor(skills, credentialKey) {
    return oauthSpecs(skills).find((spec) => spec.credentialKey === credentialKey) ?? null;
}
