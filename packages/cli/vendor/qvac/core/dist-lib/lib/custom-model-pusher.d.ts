import type { Harness } from './assistant.ts';
import type { LoggerInterface } from '@qvac/logging';
import type { openLocalStore } from './core/local/index.ts';
type LocalStore = Awaited<ReturnType<typeof openLocalStore>>;
export type CustomModelTarget = Pick<Harness, 'setCustomModels'>;
export interface CustomModelPusherOptions {
    logger?: LoggerInterface | null;
    onPushed?: () => void;
}
export declare function startCustomModelPusher(harness: CustomModelTarget, state: LocalStore, opts?: CustomModelPusherOptions): () => Promise<void>;
export {};
