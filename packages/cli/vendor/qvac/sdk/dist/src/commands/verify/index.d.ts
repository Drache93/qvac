import { type AddonSourceKind, type NativeAddon } from './addon-source.js';
import { type MissingPrebuildIssue } from './prebuilds.js';
import { type AbiIssue, type BareRuntimeResolution } from './abi.js';
import { type FetchText, type ProgressFn } from './bare-kit-runtime.js';
import { type EnginesAdvice, type FetchPackageMetadata } from './engines-advice.js';
export interface VerifyBundleOptions {
    projectRoot: string;
    addonsSource: string;
    hosts: string[];
    bareRuntimeVersion?: string;
    configPath?: string;
    /**
     * Allow GitHub and npm registry requests: GitHub for a react-native-bare-kit
     * release newer than the built-in table, the registry only after a mismatch
     * is found, to suggest an override. Defaults to true.
     */
    network?: boolean;
    /** Called before any step that waits on the network. */
    onProgress?: ProgressFn;
    /** Test seams for the network lookups. */
    fetchText?: FetchText;
    fetchPackageMetadata?: FetchPackageMetadata;
}
export interface RuntimeGroup {
    hosts: string[];
    resolution: BareRuntimeResolution;
}
export interface InvalidSourceIssue {
    code: 'invalid-source';
    level: 'error';
    message: string;
    addonsSource: string;
}
export interface InvalidRuntimeVersionIssue {
    code: 'invalid-runtime-version';
    level: 'error';
    message: string;
    providedValue: string;
    source: 'flag' | 'config';
}
export interface ConfigLoadFailedIssue {
    code: 'config-load-failed';
    level: 'warning';
    message: string;
    configPath: string;
    reason: string;
}
export interface InvalidPackageJsonIssue {
    code: 'invalid-package-json';
    level: 'warning';
    message: string;
    packageJsonPath: string;
    expectedName?: string;
    reason: string;
}
export interface EmptyBundleResolutionsIssue {
    code: 'empty-bundle-resolutions';
    level: 'warning';
    message: string;
    bundlePath: string;
}
export type VerifyBundleIssue = MissingPrebuildIssue | AbiIssue | InvalidSourceIssue | InvalidRuntimeVersionIssue | ConfigLoadFailedIssue | InvalidPackageJsonIssue | EmptyBundleResolutionsIssue;
export interface VerifyBundleResult {
    addonsSource: string;
    resolvedAddonsSource: string;
    sourceKind: AddonSourceKind | null;
    hosts: string[];
    /** Runtime of the first entry in `runtimes`: the mobile one when any host is mobile. */
    runtime: BareRuntimeResolution | null;
    /** Mobile and desktop hosts run different Bare builds, so each is resolved separately. */
    runtimes?: RuntimeGroup[];
    addons: NativeAddon[];
    issues: VerifyBundleIssue[];
    /** How to fix each runtime that fails an engines.bare range. */
    advice?: EnginesAdvice[];
}
export declare function verifyBundle(options: VerifyBundleOptions): Promise<VerifyBundleResult>;
export declare function hasErrors(result: VerifyBundleResult): boolean;
export declare function hasWarnings(result: VerifyBundleResult): boolean;
export declare function formatVerifyBundleResult(result: VerifyBundleResult): string;
//# sourceMappingURL=index.d.ts.map