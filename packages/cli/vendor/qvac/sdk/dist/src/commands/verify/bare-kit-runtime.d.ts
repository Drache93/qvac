import type { BareRuntimeResolution } from './abi.js';
export declare const REACT_NATIVE_BARE_KIT = "react-native-bare-kit";
export declare const NETWORK_TIMEOUT_MS = 5000;
export type FetchText = (url: string) => Promise<string>;
export type ProgressFn = (message: string) => void;
export interface ResolveMobileBareRuntimeOptions {
    projectRoot: string;
    network?: boolean | undefined;
    onProgress?: ProgressFn | undefined;
    fetchText?: FetchText | undefined;
}
export declare function isReactNativeBareKitInstalled(projectRoot: string): boolean;
export declare function fetchText(url: string): Promise<string>;
export declare function parseBareKitReleaseVersion(cmakeLists: string): string | null;
export declare function parseBareVersion(cmakeLists: string): string | null;
export declare function parseInfoPlistVersion(plist: string): string | null;
export declare function fetchBareKitVersionFromGitHub(reactNativeBareKitVersion: string, fetch?: FetchText): Promise<string | null>;
export declare function fetchBareVersionFromGitHub(bareKitVersion: string, fetch?: FetchText): Promise<string | null>;
export declare function bareVersionForBareKit(bareKitVersion: string): string | null;
/**
 * The oldest react-native-bare-kit release newer than `currentVersion` whose
 * embedded Bare satisfies every range, or null if the table has none.
 */
export declare function findReactNativeBareKitUpgrade(currentVersion: string, ranges: string[]): {
    version: string;
    bareKit: string;
    bare: string;
} | null;
/**
 * Bare version the app runs on mobile: the one compiled into the bare-kit
 * binaries that react-native-bare-kit ships, not any `bare-runtime` package
 * in node_modules.
 *
 * Checks the built-in table, then the installed iOS framework's Info.plist,
 * and only then GitHub.
 */
export declare function resolveMobileBareRuntime(options: ResolveMobileBareRuntimeOptions): Promise<BareRuntimeResolution>;
//# sourceMappingURL=bare-kit-runtime.d.ts.map