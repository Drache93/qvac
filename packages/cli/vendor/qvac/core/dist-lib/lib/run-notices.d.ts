export declare const RUN_ABORT_REASONS: {
    readonly suspended: 'suspended';
    readonly ownershipLost: 'ownership-lost';
    readonly runSettled: 'run-settled';
    readonly runnerDied: 'runner-died';
    readonly runnerClosed: 'runner-closed';
    readonly modelUnloaded: 'model-unloaded';
    readonly stalled: 'stalled';
};
export type RunAbortReason = (typeof RUN_ABORT_REASONS)[keyof typeof RUN_ABORT_REASONS];
export declare const RUN_FAILURE_REASONS: {
    readonly harnessDied: 'the model runtime died';
    readonly runtimeEndedTurn: 'the model runtime ended this turn';
    readonly capabilityUnavailable: 'this device cannot run a capability without a model';
    readonly stalled: 'the agent stopped responding';
    readonly videoNeedsVision: 'this model cannot see video: switch to a model that reads images to ask about one';
};
export type AbortOutcome = {
    readonly kind: 'replay';
} | {
    readonly kind: 'handoff';
} | {
    readonly kind: 'failed';
    readonly reason: string;
};
export declare function knownAbortOutcome(reason: unknown): AbortOutcome | null;
export declare function isLifecycleTeardown(reason: unknown): boolean;
export declare function runFailureNotice(error: unknown): string;
