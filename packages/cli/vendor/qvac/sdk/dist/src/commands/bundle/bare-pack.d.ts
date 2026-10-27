import type { Logger } from '../../logging/types.js';
export declare const BARE_PACK_NODE_ENGINES = "^22.21.0 || >=24.9.0";
export declare function isBarePackNodeSupported(version: string): boolean;
interface NodeVersions {
    node: string;
    bun?: string | undefined;
}
interface RunBarePackOptions {
    entryPath: string;
    outputPath: string;
    hosts: string[];
    importsMapPath: string;
    deferModules: string[];
    quiet: boolean;
    logger: Logger;
    /** The runtime running bare-pack; defaults to this process. Tests inject an older Node. */
    nodeVersions?: NodeVersions | undefined;
}
export declare function runBarePack(options: RunBarePackOptions): Promise<void>;
export {};
//# sourceMappingURL=bare-pack.d.ts.map