import type { ImageClamps, ImageModelSet } from '../../lib/models/model-catalog.ts';
import type { HarnessPlugin, PluginContext, PluginSetup } from '../../lib/plugins/index.ts';
import { loadMediaCodecs } from './edit-image.ts';
export { createEditImageTool } from './edit-image.ts';
export { createDiffusionRuntime, createGenerateImageTool, generationPercentTick, settingsDimension, settingsSteps, type DiffusionRuntime, type DiffusionRuntimeOptions, type DiffusionSdk, type DiffusionTick } from './generate-image.ts';
export interface ImageOptions {
    model: string | ImageModelSet;
    clamps?: ImageClamps;
    read?: readonly string[];
}
export declare class Image implements HarnessPlugin {
    readonly name = "image";
    readonly api = 1;
    readonly needs: string[];
    readonly addons: {
        'diffusion-cpp': () => Promise<typeof import("@qvac/diffusion-cpp/addonLogging")>;
        'bare-image-resample': () => Promise<any>;
        'bare-media': typeof loadMediaCodecs;
    };
    readonly read: readonly string[] | undefined;
    private readonly _options;
    constructor(options: ImageOptions);
    validate(): string | null;
    setup(ctx: PluginContext): PluginSetup;
}
