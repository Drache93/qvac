import type { ModelResourceProfile } from '../../schemas/model-resource-profile.js';
/**
 * Pre-download resource profiles for every catalog entry, keyed by
 * `sha256Checksum` — the same checksum a model constant carries.
 *
 * Facts only: on-disk bytes plus the GGUF transformer shape when the registry
 * captured it.
 */
export declare const MODEL_RESOURCE_PROFILES: Readonly<Record<string, ModelResourceProfile>>;
/**
 * Looks up the resource profile for a catalog model.
 *
 * @param sha256Checksum - The model constant's `sha256Checksum`.
 * @returns The profile, or `undefined` when the catalog has none for that
 *   checksum (a custom or unlisted model) — callers treat that as unknown.
 */
export declare function getModelResourceProfile(sha256Checksum: string): ModelResourceProfile | undefined;
