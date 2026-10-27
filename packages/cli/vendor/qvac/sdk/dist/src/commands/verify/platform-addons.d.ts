/**
 * Resolves split-addon platform packages from the meta package's `#host-addon`
 * map, so verify and the missing-prebuild error name the package the addon
 * actually imports.
 */
export declare const HOST_ADDON_IMPORT = "#host-addon";
/**
 * Package `#host-addon` names for `host`, if that name belongs to `metaName`.
 * `host` is a Bare host (`android-arm64`, `ios-arm64-simulator`, `darwin-arm64`)
 * or a mobile build target (`android`, `ios`).
 */
export declare function resolveAddonPlatformPackage(metaName: string, hostAddon: unknown, host: string): string | null;
/**
 * First package name a `#host-addon` map points at for `host`.
 * Android nests the package under its architecture; iOS is a flat list.
 * A platform-only `android` target uses arm64, matching the current mobile host.
 */
export declare function resolvePlatformPackageName(hostAddon: unknown, host: string): string | null;
//# sourceMappingURL=platform-addons.d.ts.map