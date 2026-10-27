import type { TtsFitWorkload } from '../../schemas/assess-model-fit.js';
import { type CanonicalModelType, type ModelSrcInput, type TranscriptionFitWorkload } from '../../schemas/index.js';
import { type FitStubOptions, type FitStubUnavailableReason } from './fetch.js';
export interface LoadDescription {
    transcriptionWorkload?: TranscriptionFitWorkload | undefined;
    ttsWorkload?: TtsFitWorkload | undefined;
    /** Absent for the loads `loadModel` also takes without one. */
    modelSrc?: ModelSrcInput | undefined;
    modelType: CanonicalModelType;
    modelConfig?: Record<string, unknown> | undefined;
}
export type ResolvedLoad = {
    status: 'resolved';
    modelPath: string;
    modelConfig: unknown;
    artifacts: Record<string, string>;
    /** Removes every stub staged for this load. Never throws. */
    release: () => Promise<void>;
};
export type LoadResolution = ResolvedLoad | {
    status: 'no-stub';
    reason: FitStubUnavailableReason;
    message?: string;
} | {
    status: 'unsupported-load';
    detail: string;
};
/**
 * Resolves a load the way `loadModel` would, against the registry's weightless
 * descriptions instead of the weights.
 *
 * The plugin's own `resolveConfig` does the work: it strips the source fields
 * from the config and returns the artifact paths keyed the way its engine
 * expects. Only what a source resolves to differs here, so the config and the
 * keys are the real load's.
 *
 * A source already on disk is read directly, since it describes the load more
 * exactly than a stub does. A files-only engine reads only sources on disk.
 */
export declare function resolveLoadFromStubs(load: LoadDescription, options?: FitStubOptions): Promise<LoadResolution>;
