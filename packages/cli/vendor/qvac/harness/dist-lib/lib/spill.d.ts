import type { ToolSpill } from './contract/index.ts';
export declare const SPILL_DIR: string;
export declare const SPILL_MAX_BYTES: number;
export declare const SPILL_MAX_AGE_MS: number;
export interface SpillOptions {
    readonly root?: string;
    readonly maxBytes?: number;
}
export declare function runSpill(runId: string, { root, maxBytes }?: SpillOptions): ToolSpill | undefined;
export declare function reserveSpillFile(dir: string, name: string, stream: string): Promise<string>;
export declare function removeRun(runId: string, root?: string): Promise<void>;
export declare function sweepSpill(now?: number, root?: string): void;
