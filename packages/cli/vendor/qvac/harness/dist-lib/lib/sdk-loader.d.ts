import type { AddonLoaders } from './contract/index.ts';
type Sdk = typeof import('#sdk');
export type SdkPlugin = Parameters<(typeof import('@qvac/inference/plugin-registry'))['registerPlugin']>[0];
type Plugin = SdkPlugin;
interface PluginRegistry {
    registerPlugin(plugin: Plugin): void;
}
export interface SdkImports {
    sdk(): Promise<Sdk>;
    plugins(): Promise<PluginRegistry>;
    llm(): Promise<{
        llmPlugin: Plugin;
    }>;
    embeddings(): Promise<{
        embeddingsPlugin: Plugin;
    }>;
}
export interface SdkLoader {
    load(): Promise<Sdk>;
    loadEmbed(): Promise<Sdk>;
    peek(): Promise<Sdk> | null;
    addons?: AddonLoaders;
}
export declare function createSdkLoader(imports?: SdkImports): SdkLoader;
export {};
