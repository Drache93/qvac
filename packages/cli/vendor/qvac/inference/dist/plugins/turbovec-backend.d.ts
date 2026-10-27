import { VectorIndexStorage } from '../schemas/index.js';
import type { VectorIndexBackend } from '../runtime/vector-index-backend.js';
/**
 * The native index reports only its effective bit width after a load. Three
 * widths map to one storage mode each; 4 bits is either `q4` or
 * `turbovec-q4`, which the snapshot header distinguishes but the addon does
 * not expose yet, so those loads report no storage mode.
 */
export declare function storageFromBitWidth(bitWidth: unknown): VectorIndexStorage | undefined;
/**
 * The vector index feature's only backend: the fabric vector index that the
 * embedding plugin exposes through the `turbovecIndexProvider` capability.
 * It serves every `VectorIndexStorage` mode; the two TurboVec modes add the
 * dimension rule (multiple of 8, at most 1024), which the native index
 * enforces itself.
 */
export declare function getTurboVecBackend(): VectorIndexBackend | undefined;
