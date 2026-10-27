export declare function generateWorkerEntry(pluginSpecifiers: string[], sdkName: string, resolveImport?: (specifier: string) => string, rpcServerProvider?: string): string;
export declare function generateWorkerEntries(pluginSpecifiers: string[], sdkName: string, resolveBundleImport: (specifier: string) => string, rpcServerProvider?: string): {
    runtimeEntry: string;
    bundleEntry: string;
};
//# sourceMappingURL=entry-gen.d.ts.map