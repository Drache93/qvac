import { type AbortSignal } from 'bare-abort-controller';
import type { QVACBlobBinding } from '@qvac/registry-client';
import type { Logger } from '../../logging/types.js';
/**
 * A weightless description of an artifact, served by the registry beside the
 * weights: for a GGUF, the tensor list and the settings with the tokenizer
 * tables stripped and no data section — tens of KB against gigabytes. The
 * fitter reads it exactly as it reads the artifact, so a projection can be made
 * before anything is downloaded.
 */
export interface FitStubRef {
    name: string;
    sha256Checksum: string;
    /** Registry coordinates. A constant that carries neither cannot be resolved. */
    registryPath?: string | undefined;
    registrySource?: string | undefined;
}
export interface FitStubSetMember extends FitStubRef {
    targetName: string;
}
export interface FitStubSet {
    primary: FitStubSetMember;
    others: readonly FitStubSetMember[];
}
export type FitStubUnavailableReason = 
/** The ref carries no registry coordinates to look up. */
'unresolvable-ref'
/** The registry has no entry at those coordinates. */
 | 'not-in-registry'
/** The entry predates fit blobs, or its description could not be built. */
 | 'no-fit-blob' | 'download-failed'
/** The lookup and the fetch together did not finish within the budget. */
 | 'timed-out'
/** The engine's fitter reads the files themselves and no registry description. */
 | 'files-only-engine';
export type FitStubOutcome = 
/** `path` is the caller's to remove once the fitter has read it. */
{
    status: 'ready';
    path: string;
    bytes: number;
} | {
    status: 'unavailable';
    reason: FitStubUnavailableReason;
    message?: string;
};
export type FitBlobBinding = QVACBlobBinding;
export interface FitStubEntry {
    fitBlobBinding?: FitBlobBinding | undefined;
}
/**
 * Injection seams. Every field defaults to the real runtime dependency; tests
 * substitute them rather than mocking modules.
 */
export interface FitStubOptions {
    signal?: AbortSignal;
    /** Where stubs are staged. Defaults to `fit-stubs` under the QVAC cache root. */
    cacheDir?: string;
    /** Overall budget for the lookup and the fetch. Defaults to `FIT_STUB_BUDGET_MS`. */
    budgetMs?: number;
    logger?: Logger;
    getEntry?: (registryPath: string, registrySource: string) => Promise<FitStubEntry | null>;
    downloadBlob?: (binding: FitBlobBinding, outputFile: string, signal?: AbortSignal) => Promise<unknown>;
}
/**
 * Bounds the registry lookup and the blob fetch together. The client's own
 * defaults — 30s per attempt, three attempts, a peer wait between them, and an
 * uncapped wait for the registry view on first use — suit a weights download.
 * Here an unreachable registry is the whole latency of the call, so it is
 * capped. Work still in flight at expiry is abandoned: the download is
 * aborted, and a lookup that cannot be cancelled settles on its own with
 * nothing waiting for it.
 *
 * One budget covers a whole companion set, so it holds the slowest case: every
 * member of a multi-stage voice model staged over a mobile network. It sits
 * above the client's per-attempt timeout rather than on it, so an attempt that
 * is about to answer is not cut at the moment it would have.
 */
export declare const FIT_STUB_BUDGET_MS = 40000;
/** Removes a fetched stub and the directory it was staged in. Never throws. */
export declare function removeStub(stubPath: string): Promise<void>;
/**
 * Fetches the fit stub for one artifact into its own staging directory and
 * returns its path. The stub is a per-call payload, not a cache: the caller
 * removes it once the fitter has read it, so nothing accumulates under the
 * QVAC root and no cleanup path has to know about it.
 *
 * Never throws: a missing entry, an entry without a description, a failed or
 * corrupt download and an expired budget are all `unavailable`, because a
 * pre-download assessment has to survive an offline caller and an older
 * registry record.
 *
 * Only the artifact named by `ref` is fetched. A split model's shards each
 * carry their own binding, and the fitter needs the whole set laid out under
 * llama's shard naming to read any of it — assembling that is not done here.
 */
export declare function fetchFitStub(ref: FitStubRef, options?: FitStubOptions): Promise<FitStubOutcome>;
/**
 * Stages a companion set under its target names in one directory, the layout a
 * downloaded set has, for engines that find their companions beside the
 * checkpoint. The primary decides the outcome; a member the registry holds no
 * description for is skipped.
 */
export declare function fetchFitStubSet(set: FitStubSet, options?: FitStubOptions): Promise<FitStubOutcome>;
