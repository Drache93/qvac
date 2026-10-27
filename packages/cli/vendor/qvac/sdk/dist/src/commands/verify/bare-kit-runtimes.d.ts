export interface BareKitRuntime {
    bareKit: string;
    bare: string;
}
/**
 * react-native-bare-kit releases whose CMakeLists.txt names the bare-kit
 * prebuilds it ships. Older releases carry no such reference.
 */
export declare const REACT_NATIVE_BARE_KIT_RUNTIMES: Record<string, BareKitRuntime>;
/** Bare version each bare-kit release is built against. */
export declare const BARE_KIT_BARE_VERSIONS: Record<string, string>;
//# sourceMappingURL=bare-kit-runtimes.d.ts.map