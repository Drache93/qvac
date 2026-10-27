export declare const PROBE_KINDS: readonly ['fold', 'title', 'suggestion'];
export type ProbeKind = (typeof PROBE_KINDS)[number];
export declare function isProbeRound(options: unknown): boolean;
