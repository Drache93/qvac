import { type AssessModelFitInput, type AssessModelFitResult } from '../schemas/index.js';
/**
 * Assesses, before anything is downloaded, whether the given models are likely
 * to fit in this device's memory.
 *
 * Advisory only: it does not download weights, block `loadModel`, reserve
 * memory, or make a performance claim. `unknown` is a real answer — it means
 * the available evidence does not support a verdict either way, and callers
 * should treat it as "cannot say", not "no".
 *
 * For each candidate it fetches the registry's weightless description of the
 * artifact — tens of KB, never the weights — and runs the engine's own fitter
 * against it, reported as `native-fit` evidence. Where that is unavailable the
 * computed floor stands, which can refuse a model but never confirm one.
 *
 * @param input - Candidates with their intended workloads, the declared
 *   execution mode, and the headroom policy.
 * @returns Per-model and combined verdicts, with the budget and bounds they came
 *   from, plus every assumption that was made.
 */
export declare function assessModelFit(input: AssessModelFitInput): Promise<AssessModelFitResult>;
