import { watchable } from './watchable.js';
export function createDiagnosticsApi(source, log) {
    return {
        diagnostics: async () => ({ stats: source.snapshot() }),
        diagnosticsWatch: watchable(() => source, async () => ({ stats: source.snapshot() }), { name: 'diagnosticsWatch', log })
    };
}
