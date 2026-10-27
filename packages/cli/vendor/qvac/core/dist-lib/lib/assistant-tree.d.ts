import Supervisor, { type ChildSpec } from 'bare-supervisor';
import { type Harness } from './assistant.ts';
import { Client } from './client.ts';
import type { Core } from './core.ts';
import type { IndexingEmbedder, RagExtractors } from './core/files/index.ts';
import type { LoggerInterface } from '@qvac/logging';
export interface HarnessContext {
    engine: Client;
    onDeath: (error?: Error) => void;
}
export type HarnessFactory = (ctx: HarnessContext) => Harness | Promise<Harness>;
export type EmbedderFactory = (harness: Harness) => IndexingEmbedder | null | undefined;
export type OnHarnessDisposer = (() => void | Promise<void>) & {
    sync?: () => Promise<void>;
    ready?: () => Promise<void>;
};
export type OnHarness = (harness: Harness, ctx: {
    engine: Client;
}) => void | OnHarnessDisposer;
export interface AssistantTreeOptions {
    core: Core;
    harness: HarnessFactory | ChildSpec<Harness>;
    logger?: LoggerInterface | null;
    imageCacheDir?: string;
    inferenceCallsDir?: string;
    runReplayDir?: string;
    imageCacheMaxBytes?: number;
    imageCacheMaxAgeMs?: number;
    embedder?: EmbedderFactory;
    extractors?: RagExtractors;
    onHarness?: OnHarness;
    platform?: string;
    preloadCurrentAgentModel?: boolean;
    fakeModels?: boolean;
}
export declare function assistantTree(opts: AssistantTreeOptions): Supervisor;
export interface AssistantChildOptions {
    harness: HarnessFactory | ChildSpec<Harness>;
    core?: string;
    logger?: LoggerInterface | null;
    imageCacheDir?: string;
    inferenceCallsDir?: string;
    runReplayDir?: string;
    imageCacheMaxBytes?: number;
    imageCacheMaxAgeMs?: number;
    embedder?: EmbedderFactory;
    extractors?: RagExtractors;
    onHarness?: OnHarness;
    preloadCurrentAgentModel?: boolean;
    fakeModels?: boolean;
    restart?: 'always' | 'never';
    maxRestarts?: number;
    window?: number;
    backoff?: number;
    maxBackoff?: number;
}
export declare function assistantChild(opts: AssistantChildOptions): ChildSpec<Supervisor>;
