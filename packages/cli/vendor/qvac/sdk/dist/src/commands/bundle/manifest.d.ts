import type { Logger } from '../../logging/types.js';
interface BarePackHeader {
    id?: string;
    main?: string;
    imports?: Record<string, unknown>;
    resolutions?: Record<string, unknown>;
}
interface GenerateAddonsManifestOptions {
    bundlePath: string;
    outputDir: string;
    projectRoot: string;
    logger: Logger;
    includeAudioDecoder?: boolean;
}
export declare const AUDIO_DECODER_ADDON = "bare-ffmpeg";
interface GenerateAddonsManifestResult {
    manifestPath: string;
    addons: string[];
}
export declare function extractPackedString(bundleJsText: string): string;
export declare function extractBarePackHeader(packed: string): BarePackHeader;
export declare function buildNestedPathIndex(resolutions: Record<string, unknown>, projectRoot: string): Map<string, Set<string>>;
export declare function generateAddonsManifest(options: GenerateAddonsManifestOptions): Promise<GenerateAddonsManifestResult>;
export {};
//# sourceMappingURL=manifest.d.ts.map