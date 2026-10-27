import { type PackageManagerName } from '../host-prebuilds/package-manager.js';
import { type BareRuntime } from './abi.js';
import type { PackageRecord } from './addon-source.js';
import { type ProgressFn } from './bare-kit-runtime.js';
export interface EnginesFailure {
    name: string;
    version?: string;
    enginesBare: string;
}
export interface EnginesParent {
    name: string;
    range: string;
    /** Whether the suggested override version satisfies this parent's range. */
    satisfied: boolean;
}
export interface EnginesOverride {
    name: string;
    installedVersions: string[];
    enginesBare: string[];
    /** Newest published version compatible with the runtime, or null if none was found. */
    version: string | null;
    parents: EnginesParent[];
    snippet: string | null;
    /** True when network lookups were disabled, so no version was searched for. */
    lookupSkipped?: boolean;
    lookupError?: string;
}
export interface EnginesUpgrade {
    packageName: string;
    from: string;
    to: string;
    bare: string;
}
export interface EnginesAdvice {
    hosts: string[];
    runtime: BareRuntime;
    requiredBare: string;
    upgrade: EnginesUpgrade | null;
    upgradeHint: string;
    overrides: EnginesOverride[];
    packageManager: PackageManagerName | null;
}
export type FetchPackageMetadata = (name: string) => Promise<PackageMetadata>;
export interface PackageMetadata {
    versions: Record<string, {
        engines?: {
            bare?: unknown;
        };
    }>;
}
export interface BuildEnginesAdviceOptions {
    projectRoot: string;
    hosts: string[];
    runtime: BareRuntime;
    failures: EnginesFailure[];
    packages: PackageRecord[];
    network?: boolean | undefined;
    onProgress?: ProgressFn | undefined;
    fetchPackageMetadata?: FetchPackageMetadata | undefined;
}
export declare function fetchPackageMetadata(name: string): Promise<PackageMetadata>;
export declare function formatOverrideSnippet(manager: PackageManagerName | null, name: string, version: string, parents: string[]): string;
/**
 * Newest release that runs on the runtime and that every parent accepts,
 * else one that at least one parent accepts. Without known parents, only the
 * installed release line (`^installed`) is considered. A version no
 * dependent accepts would only trade one failure for another, so none is
 * suggested then.
 */
export declare function pickOverrideVersion(metadata: PackageMetadata, runtimeVersion: string, installedVersions: string[], parentRanges: string[]): string | null;
export declare function buildEnginesAdvice(options: BuildEnginesAdviceOptions): Promise<EnginesAdvice>;
export declare function formatEnginesAdvice(advice: EnginesAdvice): string[];
//# sourceMappingURL=engines-advice.d.ts.map