import { type NativeAddon } from './addon-source.js';
export interface MissingPrebuildIssue {
    code: 'missing-prebuild';
    level: 'error';
    addon: string;
    host: string;
    message: string;
    packageRoot: string;
    /**
     * The per-platform package to declare for this mobile host, at the exact
     * version it must be installed at. Set when the addon's `#host-addon` map
     * names one and it is either not installed or installed at another version.
     * Never set for desktop hosts, whose platform packages install as the
     * addon's os/cpu-filtered optionalDependencies.
     */
    platformPackage?: PlatformPackagePin;
}
export interface PlatformPackagePin {
    name: string;
    version: string;
}
export declare function isMobileHost(host: string): boolean;
export interface CheckPrebuildsOptions {
    addon: NativeAddon;
    hosts: string[];
}
/**
 * One place an addon's prebuild for a host may live. `platformPackage` is set
 * when the directory belongs to a per-platform prebuild package rather than
 * the addon package itself.
 */
export interface PrebuildLocation {
    hostDir: string;
    platformPackage?: string;
    /**
     * The installed platform package's version when it differs from the
     * addon's. Platform packages are version-locked to their addon, so a
     * prebuild in a mismatched one does not count.
     */
    mismatchedVersion?: string;
}
/**
 * Where an addon's `<host>` prebuild may live:
 *
 * - `<packageRoot>/prebuilds/<host>` for an ordinary addon, including the
 *   per-platform packages themselves.
 * - For a split addon, the platform package its `#host-addon` map names for
 *   this host: `<platformRoot>/prebuilds/<host>` when that package is an
 *   addon, `<platformRoot>/addon/prebuilds/<host>` when it wraps an inner
 *   addon. Empty when the package is not installed.
 */
export declare function resolvePrebuildLocations(addon: NativeAddon, host: string): Promise<PrebuildLocation[]>;
export declare function checkPrebuilds(options: CheckPrebuildsOptions): Promise<MissingPrebuildIssue[]>;
export declare function listBarePrebuildFiles(hostDir: string): Promise<string[]>;
//# sourceMappingURL=prebuilds.d.ts.map