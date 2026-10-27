export type AddonSourceKind = 'bare-pack-bundle' | 'node-modules';
export interface NativeAddon {
    name: string;
    version?: string;
    packageJsonPath: string;
    packageRoot: string;
    enginesBare?: string;
    /**
     * Hosts whose bundle graph links this addon, and so the only ones needing a
     * prebuild; empty means the bundle links it nowhere. Absent when the source
     * carries no link information, in which case every host is checked.
     */
    linkedHosts?: string[];
}
export interface AddonPackageJson {
    name?: string;
    version?: string;
    addon?: boolean;
    imports?: Record<string, unknown>;
    engines?: {
        bare?: string;
    };
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
}
/** Any package in the collected graph, addon or not. */
export interface PackageRecord {
    name: string;
    version?: string;
    packageJsonPath: string;
    isAddon: boolean;
    enginesBare?: string;
    /** Declared ranges of every dependency kind, keyed by dependency name. */
    dependencies: Record<string, string>;
}
export interface ReadAddonPackageJsonOptions {
    packageJsonPath: string;
    expectedName?: string;
}
export interface InvalidPackageJsonRecord {
    packageJsonPath: string;
    expectedName?: string;
    reason: string;
}
export interface ReadAddonPackageJsonResult {
    found: boolean;
    isAddon: boolean;
    invalid?: InvalidPackageJsonRecord;
    addon?: NativeAddon;
    record?: PackageRecord;
    /**
     * Set for a split addon's meta package, which is not itself an addon: its
     * `binding.js` is `require('#host-addon')` and the platform packages that
     * map names (`<name>-<platform>`) are the addons actually loaded.
     */
    splitAddon?: SplitAddon;
}
export interface SplitAddon {
    addon: NativeAddon;
    /** Every platform package the meta's `#host-addon` map names. */
    platformPackages: string[];
}
export declare function readAddonPackageJson(options: ReadAddonPackageJsonOptions): Promise<ReadAddonPackageJsonResult>;
export interface CollectDiagnostics {
    invalidPackageJsons: InvalidPackageJsonRecord[];
    emptyResolutions: boolean;
    /** Every readable package the collector visited, in visit order. */
    packages: PackageRecord[];
}
export declare function createCollectDiagnostics(): CollectDiagnostics;
/**
 * Caps concurrent filesystem calls so a large node_modules tree is read in
 * parallel without exhausting file descriptors.
 */
export declare function createLimiter(max: number): <T>(task: () => Promise<T>) => Promise<T>;
export declare const FS_CONCURRENCY = 32;
export declare function formatAddonId(addon: {
    name: string;
    version?: string;
}): string;
export declare function deduplicateAddons(addons: NativeAddon[]): NativeAddon[];
//# sourceMappingURL=addon-source.d.ts.map