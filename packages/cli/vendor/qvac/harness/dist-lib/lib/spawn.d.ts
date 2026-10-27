import type { SdkStorage } from './storage.ts';
import { type StowIpc, type StowRunner } from 'bare-supervisor/stow';
import type { ChildSpec } from 'bare-supervisor';
import { type RemoteHarness } from './connect.ts';
import { type HostLogger } from './log.ts';
import { type EmbedDevice } from './models/embed-config.ts';
import type { LlamaLoadKnobs } from './models/model-pool.ts';
import type { ImageClamps, ImageModelSet, MusicClamps, MusicModelStages } from './models/model-catalog.ts';
export type MusicModelArg = string | (MusicModelStages & {
    inferenceSteps?: number;
    useGpu?: boolean;
});
export type Logger = HostLogger;
export interface HarnessLlmConfig {
    llmDevice?: 'cpu' | 'gpu';
    llmGpuLayers?: number;
    contextSize?: number;
    kvCacheK?: string;
    kvCacheV?: string;
    llmLoad?: LlamaLoadKnobs;
    slots?: number;
    completionModelCap?: number;
}
export interface HarnessKnowledgeConfig {
    dir: string;
    model: string;
}
export interface HarnessSpeechOptions {
    tts?: 'supertonic' | 'moss';
    voice?: string;
    dialogue?: {
        backbone: string;
        speakers: {
            audio: string;
            transcript: string;
        }[];
    };
}
export interface HarnessMcpServer {
    name: string;
    url: string;
    auth?: {
        tokenCredentialKey: string;
    };
    defer?: boolean;
}
export interface HarnessPluginOptions {
    speech?: HarnessSpeechOptions;
    mcp?: {
        servers?: HarnessMcpServer[];
    };
    [name: string]: unknown;
}
export interface HarnessChildOptions {
    runner: StowRunner;
    skillsDir?: string;
    gpuStats?: unknown;
    wheelsDir?: string;
    sdkStorage?: SdkStorage;
    embedDevice?: EmbedDevice;
    embedGpuLayers?: number;
    embedBatchSize?: number;
    imageModel?: string | ImageModelSet;
    imageClamps?: ImageClamps;
    musicModel?: MusicModelArg;
    musicClamps?: MusicClamps;
    llm?: HarnessLlmConfig;
    knowledge?: HarnessKnowledgeConfig;
    pluginOptions?: HarnessPluginOptions;
    onIpc?: (ipc: StowIpc) => void;
    logger?: Logger | null;
    deps?: string[];
    restart?: 'always' | 'never';
    maxRestarts?: number;
    window?: number;
    backoff?: number;
    maxBackoff?: number;
}
export declare function harnessChild(entry: string, opts: HarnessChildOptions): ChildSpec<RemoteHarness>;
export interface SpawnHarnessOptions {
    entry: string;
    gpuStats?: unknown;
    skillsDir?: string;
    wheelsDir?: string;
    sdkStorage: SdkStorage;
    embedDevice?: EmbedDevice;
    embedGpuLayers?: number;
    embedBatchSize?: number;
    imageModel?: string | ImageModelSet;
    imageClamps?: ImageClamps;
    musicModel?: MusicModelArg;
    musicClamps?: MusicClamps;
    llm?: HarnessLlmConfig;
    knowledge?: HarnessKnowledgeConfig;
    pluginOptions?: HarnessPluginOptions;
    logger?: Logger | null;
}
export declare function spawnHarness(opts: SpawnHarnessOptions): RemoteHarness;
