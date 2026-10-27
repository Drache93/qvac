export type CheckState = 'pass' | 'warn' | 'fail' | 'declared' | 'pending';
export interface Verdict {
    state: CheckState;
    detail: string;
    fix?: string | undefined;
}
export interface Check extends Verdict {
    group: string;
    name: string;
}
export interface Samples {
    first: unknown;
    second?: unknown;
}
export declare function runChecks(samples: Samples): Check[];
