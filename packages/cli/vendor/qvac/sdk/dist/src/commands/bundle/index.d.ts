import { type HostPrebuildPackage } from '../host-prebuilds/index.js';
export interface BundleSdkOptions {
    projectRoot?: string | undefined;
    configPath?: string | undefined;
    sdkPath?: string | undefined;
    hosts?: string[] | undefined;
    defer?: string[] | undefined;
    quiet?: boolean | undefined;
    verbose?: boolean | undefined;
    /**
     * Install the addon platform packages that the split addons the bundle
     * reaches need for its mobile hosts, with the project's package manager
     * (see `ensureHostPrebuilds`), before bundling. Off by default: without it,
     * bundling never changes package.json or node_modules, and a mobile host
     * whose platform package is missing fails with `HostPrebuildsMissingError`,
     * naming the exact pins. A refused install
     * throws `HostPrebuildsInstallRefusedError` before anything is written.
     */
    installMissingPrebuilds?: boolean | undefined;
    /**
     * Check the bundled packages' engines.bare against the Bare runtime of each
     * host and warn on a mismatch. Defaults to true; callers that run
     * `verifyBundle` on the result can turn it off.
     */
    checkEngines?: boolean | undefined;
    /** Allow network lookups during the engines check. Defaults to true. */
    network?: boolean | undefined;
}
export interface BundleSdkResult {
    bundlePath: string;
    plugins: string[];
    addons: string[];
    entryPaths: {
        worker: string;
    };
    manifestPath: string;
    /** Platform packages `installMissingPrebuilds` installed; empty when it is off. */
    installedPrebuilds: HostPrebuildPackage[];
}
export declare function bundleSdk(options?: BundleSdkOptions): Promise<BundleSdkResult>;
//# sourceMappingURL=index.d.ts.map