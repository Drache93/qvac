import '../hardware/gpu-probe-entry.ts';
import { Harness } from '../../index.ts';
import type { HarnessPlugin } from '../plugins/index.ts';
import type { Stream } from '../rpc-session.ts';
import type { HarnessKnowledgeConfig, HarnessPluginOptions, MusicModelArg } from '../spawn.ts';
import type { SdkStorage } from '../storage.ts';
import type { CredentialStoreFn } from '../tools/skills/auth-resolver.ts';
import { type SkillCatalogEntry } from '../tools/skills/catalog.ts';
import { type LeftOut } from './user-plugins.ts';
import { type ImageClamps, type ImageModelSet, type MusicClamps } from '../models/model-catalog.ts';
export interface SidecarContext {
    pluginOptions: HarnessPluginOptions;
    sdkStorage: SdkStorage;
    skillsDir: string;
    skillCatalog: SkillCatalogEntry[] | undefined;
    credentialStore: CredentialStoreFn | undefined;
    imageModel: string | ImageModelSet | undefined;
    imageClamps: ImageClamps | undefined;
    musicModel: Exclude<MusicModelArg, string> | undefined;
    musicClamps: MusicClamps | undefined;
    knowledge: HarnessKnowledgeConfig | undefined;
}
export type SidecarPlugins = (ctx: SidecarContext) => HarnessPlugin[];
interface Log {
    info(...args: unknown[]): void;
    debug(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
}
export declare class HarnessSidecar {
    private readonly _plugins;
    constructor(plugins: SidecarPlugins);
    static start(ipc: Stream, ready: () => void, plugins: SidecarPlugins): Promise<() => void>;
    static loadUserPlugins(dir: string, leftOut: LeftOut): Promise<HarnessPlugin[]>;
    start(ipc: Stream, ready: () => void): Promise<() => void>;
}
export declare const HOST_MODULE_ENV = "QVAC_HARNESS_HOST_MODULE";
export declare function addHostModule(harness: Harness, log: Pick<Log, 'error'>, env?: Record<string, string | undefined>): Promise<void>;
export {};
