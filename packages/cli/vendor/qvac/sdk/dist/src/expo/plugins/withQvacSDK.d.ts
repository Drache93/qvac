import type { ExpoConfig } from 'expo/config/index.js';
import { type MobileBundleOptions } from './withMobileBundle.js';
type QvacSDKPluginOptions = MobileBundleOptions;
/**
 * Main Qvac SDK Expo plugin that combines all necessary mobile configurations:
 * - Mobile worker bundle generation
 * - Device info stubbing when expo-device is not installed
 * - Android build properties (minSdkVersion, NDK, proguard)
 * - Android NDK version pinning in build.gradle
 * - Android architecture filtering (arm64-v8a only)
 * - OpenCL native library support for Android
 *
 * Options (`["@qvac/sdk/expo-plugin", { ... }]` in app.json) go to
 * `withMobileBundle`.
 */
declare function withQvacSDK(config: ExpoConfig, options?: QvacSDKPluginOptions): ExpoConfig;
export type { QvacSDKPluginOptions };
export default withQvacSDK;
//# sourceMappingURL=withQvacSDK.d.ts.map