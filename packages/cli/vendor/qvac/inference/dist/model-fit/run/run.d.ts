import type { AbortSignal } from 'bare-abort-controller';
import { callEngineFit } from './engine.js';
import type { FitProbeRequest, FitProbeResult } from './engine.js';
/**
 * Why a run produced no projection. Every one of these is absence of evidence,
 * so the caller proceeds with the load it was going to run anyway.
 */
export type FitRunUnknownReason = 'cancelled' | 'crashed' | 'invocation-error' | 'timeout';
export type FitRunResult = {
    status: 'completed';
    probe: FitProbeResult;
} | {
    status: 'unknown';
    reason: FitRunUnknownReason;
    message: string;
};
export interface RunFitOptions {
    signal?: AbortSignal;
    timeoutMs?: number;
    stateDir?: string;
    callFit?: typeof callEngineFit;
}
export declare function runningMarkerPath(stateDir: string, probe: FitProbeRequest, pid?: number): string;
export declare function suspectMarkerPath(stateDir: string, probe: FitProbeRequest): string;
export declare function crashedMarkerPath(stateDir: string, probe: FitProbeRequest): string;
/**
 * Runs one engine's fitter in this process.
 *
 * A fitter that aborts takes the process with it, as does a process that quits
 * or is killed mid-fit. Each process marks its fit with a `.running` file named
 * by its pid, so a marker whose process is gone is a fit that never finished,
 * while one whose process is alive is a fit still running there. The first
 * unfinished fit of a request leaves `.suspect` and the fit runs again. A
 * second one in a row leaves `.crashed`, and the request skips native until
 * that marker expires.
 *
 * Fits of one request in this process share one marker, removed by the last.
 * An aborted `signal` answers `cancelled` and a fit past `timeoutMs` answers
 * `timeout`, both at once, while the fitter runs on and releases the marker
 * when it returns. Until a timed-out fitter returns, further fits of its
 * request answer `timeout` without calling it again.
 */
export declare function runFit(probe: FitProbeRequest, options?: RunFitOptions): Promise<FitRunResult>;
