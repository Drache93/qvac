export const TOOLSETS = [
    'web-search',
    'knowledge',
    'files',
    'exec',
    'http-request',
    'mcp-call',
    'image',
    'music',
    'coding',
    'team'
];
export function asToolset(value) {
    return TOOLSETS.find((toolset) => toolset === value) ?? null;
}
export function toolsetEnabled(toolset, disabled) {
    return !disabled?.includes(toolset);
}
