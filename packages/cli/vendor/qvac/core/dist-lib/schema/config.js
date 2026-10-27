export function registerConfigTypes(ns) {
    ns.register({
        name: 'config',
        fields: [{ name: 'minSupportedVersion', type: 'string', required: true }]
    });
}
export const VENDORED_MIN_SUPPORTED_VERSION = '>=0.21.0';
