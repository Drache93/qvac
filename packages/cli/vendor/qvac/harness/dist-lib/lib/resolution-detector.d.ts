export declare function resolutionDetail(err: unknown): Record<string, unknown>;
export declare function isReferrerLost(referrer: unknown, parent: string, cache: object | null): boolean;
export declare function resolutionFailure(specifier: string, parent: string, err: unknown): Record<string, unknown>;
export declare function installResolutionDetector(meta: ImportMeta): () => void;
export declare function uninstallResolutionDetector(): void;
