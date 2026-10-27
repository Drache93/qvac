import type { QVACRegistryClient } from '@qvac/registry-client';
import type { RegistryItem } from '../../models/registry/models.js';
type BundleSpec = {
    sourceName: string;
    targetSuffix: string;
};
export type CoremlSidecarSpec = {
    root: string;
    modelStem: string;
    bundles: readonly BundleSpec[];
};
type CompanionSet = NonNullable<RegistryItem['companionSet']>;
export declare function getCoremlSidecarSpec(registryPath: string, registrySource: string, platform: string | undefined): CoremlSidecarSpec | undefined;
export declare function getCoremlSetKey(model: RegistryItem, spec: CoremlSidecarSpec): string;
export declare function readCachedCoremlCompanionSet(model: RegistryItem, platform: string | undefined, cacheDir?: string): Promise<CompanionSet | undefined>;
export declare function writeCachedCoremlCompanionSet(set: CompanionSet, cacheDir?: string): Promise<void>;
export declare function findCatalogCoremlCompanionSet(model: RegistryItem, platform: string | undefined): CompanionSet | undefined;
export declare function findLocallyCachedCoremlCompanionSet(model: RegistryItem, platform: string | undefined, cacheDir?: string): Promise<CompanionSet | undefined>;
/**
 * Build the existing companion-set shape from live registry metadata. The
 * sidecars are optional and are not part of the generated GGUF constants;
 * this lets the SDK use them as soon as the registry has ingested the files.
 */
export declare function findCoremlCompanionSet(client: Pick<QVACRegistryClient, 'findModels'>, model: RegistryItem, platform: string | undefined): Promise<CompanionSet | undefined>;
export {};
