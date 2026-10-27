export const QVAC_ADDON_PACKAGES: ReadonlyArray<string>
export function deferSpecifiers(): string[]
export function deferredAddonPackages(bundle: { resolutions: Record<string, unknown> }): string[]
export function collectRuntimeClosure(
  nodeModulesDir: string,
  seeds?: ReadonlyArray<string>,
  hosts?: ReadonlyArray<string>
): string[]
export function hostPackage(nodeModulesDir: string, name: string, host: string): string | null
export function hostPrebuildDir(nodeModulesDir: string, name: string, host: string): string | null
export function copyAddonExternals(
  nodeModulesDir: string,
  destNodeModulesDir: string,
  hosts: ReadonlyArray<string>,
  seeds?: ReadonlyArray<string>
): string[]
export function assertNoBundledAddonModules(
  bundleKeys: ReadonlyArray<string>,
  nodeModulesDir: string
): void
export const NATIVE_ADDON_PACKAGES: ReadonlyArray<string>
export function nativeAddonPackages(
  artifactPaths: ReadonlyArray<string>,
  nodeModulesDir: string,
  seeds?: ReadonlyArray<string>
): string[]
export function assertNativeAddonAllowlist(
  found: ReadonlyArray<string>,
  listed?: ReadonlyArray<string>
): void
