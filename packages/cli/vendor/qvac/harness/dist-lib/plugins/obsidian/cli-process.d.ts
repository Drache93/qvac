import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import { type ObsidianPathProbe } from './readiness.ts';
import type { KillProcess, SpawnFn } from '../../lib/tools/exec/runner.ts';
export declare function runningCheckCommand(os: string): string;
export declare function launchCommand(os: string): string;
export declare function obsidianPathEnv(platform?: NodeJS.Platform, env?: Record<string, string | undefined>, probe?: ObsidianPathProbe): Record<string, string> | undefined;
export interface ObsidianRunningOptions {
    readonly killProcess?: KillProcess | undefined;
    readonly signal?: BareAbortSignal | undefined;
    readonly platform?: NodeJS.Platform;
}
export declare function isObsidianRunning(spawn: SpawnFn, { killProcess, signal, platform }?: ObsidianRunningOptions): Promise<boolean>;
export declare function launchObsidianApp(spawn: SpawnFn, platform?: NodeJS.Platform): void;
