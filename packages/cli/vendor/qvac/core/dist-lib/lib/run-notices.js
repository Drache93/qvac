export const RUN_ABORT_REASONS = {
    suspended: 'suspended',
    ownershipLost: 'ownership-lost',
    runSettled: 'run-settled',
    runnerDied: 'runner-died',
    runnerClosed: 'runner-closed',
    modelUnloaded: 'model-unloaded',
    stalled: 'stalled'
};
export const RUN_FAILURE_REASONS = {
    harnessDied: 'the model runtime died',
    runtimeEndedTurn: 'the model runtime ended this turn',
    capabilityUnavailable: 'this device cannot run a capability without a model',
    stalled: 'the agent stopped responding',
    videoNeedsVision: 'this model cannot see video: switch to a model that reads images to ask about one'
};
export function knownAbortOutcome(reason) {
    if (reason === RUN_ABORT_REASONS.suspended ||
        reason === RUN_ABORT_REASONS.runnerClosed ||
        reason === RUN_ABORT_REASONS.modelUnloaded) {
        return { kind: 'replay' };
    }
    if (reason === RUN_ABORT_REASONS.ownershipLost || reason === RUN_ABORT_REASONS.runSettled) {
        return { kind: 'handoff' };
    }
    if (reason === RUN_ABORT_REASONS.runnerDied) {
        return { kind: 'failed', reason: RUN_FAILURE_REASONS.harnessDied };
    }
    if (reason === RUN_ABORT_REASONS.stalled) {
        return { kind: 'failed', reason: RUN_FAILURE_REASONS.stalled };
    }
    return null;
}
export function isLifecycleTeardown(reason) {
    return knownAbortOutcome(reason)?.kind === 'replay';
}
export function runFailureNotice(error) {
    if (error instanceof Error && error.message)
        return error.message;
    if (typeof error === 'string' && error.trim())
        return error;
    return RUN_FAILURE_REASONS.runtimeEndedTurn;
}
