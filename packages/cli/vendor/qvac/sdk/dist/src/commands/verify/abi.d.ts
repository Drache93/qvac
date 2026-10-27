import { type NativeAddon } from './addon-source.js';
export interface BareRuntime {
    version: string;
    source: 'flag' | 'config' | 'bare-runtime' | 'bare' | 'react-native-bare-kit';
    /** Installed version of the package named by `source`, when it differs from `version`. */
    packageVersion?: string;
    detail?: string;
}
export interface UnresolvedBareRuntime {
    reason: string;
    triedPaths: string[];
}
export interface ResolveBareRuntimeOptions {
    projectRoot: string;
    explicitVersion?: string;
    explicitSource?: 'flag' | 'config';
}
export type BareRuntimeResolution = {
    resolved: true;
    runtime: BareRuntime;
} | {
    resolved: false;
    error: UnresolvedBareRuntime;
};
export interface AbiMismatchIssue {
    code: 'abi-mismatch';
    level: 'error';
    addon: string;
    message: string;
    enginesBare: string;
    runtimeVersion: string;
}
/** A bundled package that is not an addon but still declares engines.bare. */
export interface EnginesMismatchIssue {
    code: 'engines-mismatch';
    level: 'error';
    package: string;
    message: string;
    enginesBare: string;
    runtimeVersion: string;
}
export interface UnknownRuntimeIssue {
    code: 'unknown-runtime-version';
    level: 'warning';
    message: string;
    triedPaths: string[];
}
export interface MalformedEnginesBareIssue {
    code: 'malformed-engines-bare';
    level: 'warning';
    addon: string;
    enginesBare: string;
    message: string;
}
export type AbiIssue = AbiMismatchIssue | EnginesMismatchIssue | UnknownRuntimeIssue | MalformedEnginesBareIssue;
export interface CheckAbiOptions {
    addons: NativeAddon[];
    runtime: BareRuntimeResolution;
    /** Non-addon packages that declare engines.bare. */
    packages?: EnginesPackage[] | undefined;
}
export interface EnginesPackage {
    name: string;
    version?: string;
    enginesBare: string;
}
export declare function resolveBareRuntime(options: ResolveBareRuntimeOptions): Promise<BareRuntimeResolution>;
export declare function normalizeVersion(value: string): string | null;
export declare function formatConfigLabel(projectRoot: string, configPath?: string): string;
export declare function formatRuntimeSource(runtime: BareRuntime): string;
export declare function checkAbi(options: CheckAbiOptions): AbiIssue[];
//# sourceMappingURL=abi.d.ts.map