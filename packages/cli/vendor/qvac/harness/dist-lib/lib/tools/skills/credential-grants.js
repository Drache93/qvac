import { credentialSlots } from './credential-slots.js';
export function credentialGrants(catalog, skills) {
    if (!skills || skills.length === 0)
        return {};
    const loaded = new Set(skills);
    const map = {};
    for (const entry of catalog) {
        if (entry.origin === 'overlay')
            continue;
        if (!loaded.has(entry.name) || entry.allowList.length === 0)
            continue;
        for (const key of credentialSlots(entry).flat()) {
            map[key] = [...new Set([...(map[key] ?? []), ...entry.allowList])];
        }
    }
    return map;
}
export function credentialAllowListFor(catalog) {
    return (ctx) => credentialGrants(catalog, ctx?.skills);
}
