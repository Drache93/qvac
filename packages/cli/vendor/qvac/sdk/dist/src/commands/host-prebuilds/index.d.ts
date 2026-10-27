import type { Logger } from '../../logging/types.js';
import { type NativeAddon } from '../verify/addon-source.js';
import { type PackageManagerName } from './package-manager.js';
export type { PackageManagerName } from './package-manager.js';
export interface EnsureHostPrebuildsOptions {
    /** The package whose package.json receives the pins; its package manager installs them. */
    projectRoot: string;
    /** Bare hosts to cover. Only mobile hosts (`android-*`, `ios-*`) can need an install. */
    hosts: string[];
    /**
     * Addon package names to cover. Defaults to every addon installed for the
     * project, split addon metas included: in its own node_modules or in that
     * of a workspace root listing it.
     */
    addons?: string[] | undefined;
    /** Install with this package manager instead of detecting the project's own. */
    packageManager?: PackageManagerName | undefined;
    quiet?: boolean | undefined;
    verbose?: boolean | undefined;
}
export interface HostPrebuildPackage {
    /** The platform package, e.g. `@qvac/tts-ggml-android-arm64`. */
    name: string;
    /** Always the addon's own version: platform packages are version-locked to it. */
    version: string;
    /** The addon the package ships prebuilds for. */
    addon: string;
    /** The requested hosts the package covers. */
    hosts: string[];
}
export interface EnsureHostPrebuildsResult {
    /** The packages this call installed; empty when every prebuild already resolved. */
    installed: HostPrebuildPackage[];
    /** The package manager that installed them, or null when nothing was missing. */
    packageManager: PackageManagerName | null;
}
/**
 * Installs the per-platform prebuild packages that addons need for mobile
 * hosts and that the project does not have yet.
 *
 * A split addon names one platform package per host in the `#host-addon` map
 * of its package.json (`<addon>-ios` covers every iOS host) and loads its
 * native code from that package alone. Desktop platform packages install as
 * os/cpu-filtered optionalDependencies, but a build host never reports a
 * mobile os, so mobile ones have to be declared.
 * This declares the missing ones in package.json, pinned to each addon's
 * exact version, using the project's own package manager.
 *
 * A host whose platform package is already installed at the addon's version
 * is skipped. Throws `HostPrebuildsInstallRefusedError` when no
 * supported package manager (npm 7+, pnpm, bun, Yarn Berry) is found, and
 * `HostPrebuildsInstallFailedError` when the install does not produce the
 * packages.
 */
export declare function ensureHostPrebuilds(options: EnsureHostPrebuildsOptions): Promise<EnsureHostPrebuildsResult>;
export interface InstallMissingHostPrebuildsOptions {
    projectRoot: string;
    hosts: string[];
    addons: NativeAddon[];
    packageManager?: PackageManagerName | undefined;
    quiet: boolean;
    logger: Logger;
}
/** `ensureHostPrebuilds` for addons the caller has already located. */
export declare function installMissingHostPrebuilds(options: InstallMissingHostPrebuildsOptions): Promise<EnsureHostPrebuildsResult>;
/**
 * The platform packages `addons` still need for the mobile hosts in `hosts`,
 * one entry per package. Throws when two installed versions of one addon need
 * the same platform package, since only one version of it can be installed.
 */
export declare function findMissingHostPrebuilds(addons: NativeAddon[], hosts: string[]): Promise<HostPrebuildPackage[]>;
/**
 * The installed addons named in `names`, or every installed addon when
 * `names` is omitted, split addon metas included. For each name the copy in
 * the nearest modules directory wins, as it does for Node's resolver. Without
 * `names`, the packages nested in each package's own node_modules count too.
 */
export declare function resolveAddons(projectRoot: string, names: string[] | undefined, logger: Logger): Promise<NativeAddon[]>;
//# sourceMappingURL=index.d.ts.map