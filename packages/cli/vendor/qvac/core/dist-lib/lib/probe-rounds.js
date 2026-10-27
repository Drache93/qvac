import { isRecord } from './guards.js';
export const PROBE_KINDS = ['fold', 'title', 'suggestion'];
export function isProbeRound(options) {
    return isRecord(options) && PROBE_KINDS.some((kind) => kind === options.kind);
}
