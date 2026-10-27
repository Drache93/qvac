import configPlugins from '@expo/config-plugins';
import type { ExpoConfig } from 'expo/config/index.js';
/**
 * Desktop-only spawn path. `bare-runtime` maps `process` to `bare-process`
 * under Bare, which pulls `bare-posix` (no `android-arm64` prebuild), so
 * bare-pack must not walk it.
 */
declare const MOBILE_UNSUPPORTED_MODULES: string[];
type MobilePlatform = 'android' | 'ios';
declare const MOBILE_HOSTS_BY_PLATFORM: Record<MobilePlatform, string[]>;
/** Every mobile host, in platform order. The bundle covers all of them. */
declare const MOBILE_HOSTS: string[];
type MobileBundleOptions = {
    /**
     * Install the platform packages the app's split addons need for every
     * mobile host the bundle covers (both platforms: the bundle is shared) with
     * the app's package manager, pinned in package.json. Off by default:
     * `expo prebuild` then fails and names each package to add.
     */
    installMissingPrebuilds?: boolean;
};
/**
 * Expo plugin: bundles the worker for every mobile host, verifies it for the
 * platform being prebuilt, copies it to `<sdkPackageDir>/dist/worker.mobile.bundle.js`,
 * and links the native addons it loads into react-native-bare-kit. Uses
 * `qvac.config.*` if present.
 */
declare function withMobileBundle(config: ExpoConfig, options?: MobileBundleOptions): ExpoConfig;
declare function buildMobileBundle<T extends configPlugins.ExportedConfigWithProps<unknown>>(config: T, options: MobileBundleOptions): Promise<T>;
declare function mobileHostsForPlatform(platform: string): string[];
export { MOBILE_HOSTS, MOBILE_HOSTS_BY_PLATFORM, MOBILE_UNSUPPORTED_MODULES, buildMobileBundle, mobileHostsForPlatform };
export type { MobileBundleOptions, MobilePlatform };
export default withMobileBundle;
//# sourceMappingURL=withMobileBundle.d.ts.map