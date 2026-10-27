import { type QvacPlugin, type PluginHandlerDefinition } from '../schemas/plugin.js';
export declare function registerPlugin(plugin: QvacPlugin): void;
export declare function registerPlugins(pluginList: readonly QvacPlugin[]): void;
/**
 * Wires the addon logger of a plugin that supplied a resolver, loading the
 * addon on the way. Call it once a model of this type is actually being
 * created: it is the point where the addon is needed anyway, so a host
 * missing that addon's platform package fails the load it asked for instead
 * of failing every plugin registration at startup.
 *
 * A no-op for plugins that passed their module directly — those are already
 * wired by `registerPlugin` — and for a namespace that is already wired,
 * which is how two plugins over one addon (whisper and Parakeet over ASR)
 * share a single `setLogger` call. Also a no-op when the registry was cleared
 * while the addon was loading, so a shutdown that races a load leaves no
 * logger behind.
 */
export declare function ensureAddonLoggerReady(plugin: QvacPlugin): Promise<void>;
export declare function getPlugin(modelType: string): QvacPlugin | undefined;
export declare function getPluginHandler(modelType: string, handlerName: string): PluginHandlerDefinition | undefined;
export declare function hasPlugin(modelType: string): boolean;
export declare function unregisterPlugin(modelType: string): boolean;
export declare function getAllPlugins(): QvacPlugin[];
export declare function getTurboVecIndexProvider(): import("@qvac/rag").TurboVecIndexProvider | undefined;
export declare function clearPlugins(): void;
