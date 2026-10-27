import type { NativeProbeFit } from '../schemas/index.js';
import type { FitProbeResult } from './run/engine.js';
export declare function classifyFit(probe: FitProbeResult, provenance: {
    basis: 'native-probe';
    estimatorVersion: string;
}): NativeProbeFit;
