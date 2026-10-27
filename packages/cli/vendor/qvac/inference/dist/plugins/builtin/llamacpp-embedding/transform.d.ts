import type { GGMLConfig } from '@qvac/embed-llamacpp';
import { type EmbedConfig } from '../../../schemas/index.js';
/**
 * Converts an EmbedConfig into the flat string-keyed map the C++ addon expects.
 *
 * Extracted from the plugin so the advisory fit check can build its request
 * from the same transform the real embedding load uses.
 */
export declare function transformEmbedConfig(embedConfig: EmbedConfig): GGMLConfig;
