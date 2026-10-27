export function credentialSlots(entry) {
    return [...new Set([...(entry.credentials ?? []), ...(entry.requires?.credentials ?? [])])]
        .map((raw) => raw
        .split('|')
        .map((key) => key.trim())
        .filter(Boolean))
        .filter((alts) => alts.length > 0);
}
