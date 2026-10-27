import '../../index.ts';
import '../plugins/index.ts';
import '../plugins/context.ts';
import '../helpers/race-abort.ts';
import type { HarnessPlugin } from '../plugins/index.ts';
export type LeftOut = (name: string, reason: string) => void;
export declare function userConfigDir(env?: Record<string, string | undefined>): string;
export declare function loadUserPlugins(dir: string, leftOut: LeftOut): Promise<HarnessPlugin[]>;
export declare function sharedImports(): Promise<Record<string, string>>;
