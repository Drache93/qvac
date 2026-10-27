import { errorMessage } from './guards.js';
import { missingPeers, requirePeers } from './helpers/require-peers.js';
import { retryMemo } from './helpers/retry-memo.js';
import { HarnessLog } from './log.js';
const defaultImports = {
    sdk: () => import('#sdk'),
    plugins: () => import('@qvac/inference/plugin-registry'),
    llm: () => import('@qvac/inference/llamacpp-completion/plugin'),
    embeddings: () => import('@qvac/inference/llamacpp-embedding/plugin')
};
function register(registry, name, plugin) {
    try {
        registry.registerPlugin(plugin);
    }
    catch (err) {
        HarnessLog.warn('plugin registration skipped', {
            plugin: name,
            err: errorMessage(err)
        });
    }
}
const IN_PROCESS = typeof globalThis.Bare !== 'undefined';
const COMPLETION_PEERS = IN_PROCESS
    ? {
        '@qvac/llm-llamacpp': () => import.meta.resolve('@qvac/llm-llamacpp/addonLogging'),
        '@qvac/langdetect-text': () => import.meta.resolve('@qvac/langdetect-text')
    }
    : { '@qvac/sdk': () => import.meta.resolve('#sdk') };
const EMBEDDING_PEERS = {
    '@qvac/embed-llamacpp': () => import.meta.resolve('@qvac/embed-llamacpp/addonLogging')
};
const requireCompletion = () => requirePeers('@qvac/harness completion', COMPLETION_PEERS);
export function createSdkLoader(imports = defaultImports) {
    const load = retryMemo(async () => {
        requireCompletion();
        if (!IN_PROCESS) {
            return imports.sdk();
        }
        const [sdk, { llmPlugin }, registry] = await Promise.all([
            imports.sdk(),
            imports.llm(),
            imports.plugins()
        ]);
        register(registry, 'llm', llmPlugin);
        return sdk;
    });
    const loadEmbed = IN_PROCESS
        ? retryMemo(async () => {
            requirePeers('@qvac/harness embeddings', EMBEDDING_PEERS);
            const [sdk, { embeddingsPlugin }, registry] = await Promise.all([
                load(),
                imports.embeddings(),
                imports.plugins()
            ]);
            register(registry, 'embeddings', embeddingsPlugin);
            return sdk;
        })
        : load;
    return { load, loadEmbed, peek: () => load.peek(), addons: addonLoaders(load, loadEmbed) };
}
function addonLoaders(load, loadEmbed) {
    const completion = {
        sdk: load,
        'llm-llamacpp': () => {
            requireCompletion();
            return import('@qvac/llm-llamacpp/addonLogging');
        }
    };
    if (missingPeers(EMBEDDING_PEERS).length > 0) {
        return completion;
    }
    return {
        ...completion,
        embeddings: loadEmbed,
        'embed-llamacpp': () => import('@qvac/embed-llamacpp/addonLogging')
    };
}
