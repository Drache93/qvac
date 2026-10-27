import type { Logger } from '../../logging/types.js';
export interface LinkAddonsOptions {
    projectRoot: string;
    entryPath: string;
    hosts: string[];
    logger: Logger;
}
/**
 * Links the native addons the worker entry loads into react-native-bare-kit
 * for each phone platform in `hosts`, replacing what the platform had.
 */
export declare function linkAddons(options: LinkAddonsOptions): Promise<string[]>;
/**
 * Addons that ship a library under the same name write it to the same path,
 * and the copy linked last is the one the app loads.
 */
export declare function warnOverwritten(written: string[], out: string, logger: Logger): void;
//# sourceMappingURL=link-addons.d.ts.map