export const METADATA_METHODS = new Set([
    'initialize',
    'ping',
    'tools/list',
    'resources/list',
    'resources/read',
    'resources/templates/list',
    'prompts/list',
    'prompts/get',
    'completion/complete'
]);
export function isMetadataMethod(method) {
    return typeof method === 'string' && METADATA_METHODS.has(method);
}
