import type { GgufFacts } from '../schemas/model-resource-profile.js';
export declare const LLAMA_WEIGHTS_ASSUMPTION = "weights are counted at full artifact size; llama.cpp maps them by default, so those pages are file-backed and evictable rather than anonymous RAM";
/**
 * The narrowest KV-cache element width the engine can default to for this
 * model, in bytes: q8_0 where flash attention allows it, f16 otherwise.
 */
export declare function narrowestKvElementBytes(facts: GgufFacts): number;
/**
 * The smallest KV cache the requested context can need, at a fixed element
 * width and clamped to the trained context.
 *
 * Three cases, in order of how much the file actually tells us:
 *
 * 1. **Per-layer classes** — the file describes attention per block, so the
 *    cache is summed exactly, with sliding-window blocks capped at their window.
 * 2. **Hybrid attention/recurrent** — `full_attention_interval` says how many
 *    blocks hold a cache at all; the rest hold a fixed-size SSM state. Which
 *    blocks are which is engine-owned, so the fewest full blocks are counted.
 * 3. **Flat** — every block holds the same cache. A declared sliding window
 *    with no per-layer pattern is engine-owned, so every block is counted
 *    windowed.
 */
export declare function kvCacheFloorBytes(facts: GgufFacts, contextTokens: number, elementBytes: number): number;
