import { and, emit, fromPromise, not, or, setup, stateIn } from 'xstate';
import { tagError } from '../../helpers/engine-error.js';
import { completionActions, completionGuards } from './implementations.js';
const MAX_DELAY = 2 ** 31 - 1;
const withParent = ({ self }) => ({ parent: self });
const selected = (value) => value;
const activeOrResuming = or([stateIn('#completion.active'), stateIn('#completion.resuming')]);
const inFinishing = stateIn('#completion.active.finishing');
const activeResumingOrPausing = or([activeOrResuming, stateIn('#completion.pausing')]);
const nextRoundAck = {
    type: 'ackSteering',
    params: ({ context }) => ({ round: context.round + 1 })
};
const sameRoundAck = {
    type: 'ackSteering',
    params: ({ context }) => ({ round: context.round })
};
function directToolRouting() {
    return [
        {
            guard: 'directRejected',
            target: 'tools.rejecting',
            actions: {
                type: 'rejectTool',
                params: ({ event }) => {
                    const direct = selected(event.output.directTool);
                    return {
                        call: direct.call,
                        execution: direct.execution,
                        rejection: selected(direct.rejection)
                    };
                }
            }
        },
        {
            guard: 'directNeedsApproval',
            target: 'tools.approving',
            actions: [
                {
                    type: 'startDirectTool',
                    params: ({ event }) => selected(event.output.directTool)
                },
                {
                    type: 'requestApproval',
                    params: ({ event }) => selected(event.output.directTool?.execution).gate.call
                }
            ]
        },
        {
            guard: 'directAutoRuns',
            target: 'tools.executing',
            actions: {
                type: 'startDirectTool',
                params: ({ event }) => selected(event.output.directTool)
            }
        },
        { guard: 'noDirectTool', target: 'round' }
    ];
}
const noClock = () => 0;
function unprovided() {
    return fromPromise(() => Promise.reject(new Error('Completion runtime implementations were not provided')));
}
const settled = () => fromPromise(() => Promise.resolve());
const placeholderActors = {
    preparing: unprovided(),
    inspectPrepare: unprovided(),
    runPrepare: unprovided(),
    searching: unprovided(),
    generating: unprovided(),
    resolving: unprovided(),
    inspecting: unprovided(),
    rejecting: unprovided(),
    approving: unprovided(),
    executing: unprovided(),
    batching: unprovided(),
    wrapping: unprovided(),
    answering: unprovided(),
    retrieving: unprovided(),
    finishing: unprovided(),
    cleanup: settled(),
    resume: settled()
};
const createCompletionMachineImplementation = (context, now = noClock) => setup({
    types: {},
    actors: placeholderActors,
    actions: completionActions,
    guards: {
        ...completionGuards,
        errorInPausing: stateIn('#completion.pausing'),
        errorInActiveOrResumingAndRecoveryRequired: and([activeOrResuming, 'needsRecovery']),
        errorInActiveOrResumingAndInterrupted: and([activeOrResuming, 'interrupted']),
        errorInFinishing: inFinishing,
        failInFinishing: inFinishing,
        errorInRoutableState: activeResumingOrPausing
    },
    delays: {
        deadline: ({ context }) => {
            const deadline = context.durable?.runBudget.deadlineMs;
            return deadline === undefined ? MAX_DELAY : clamp(deadline - now());
        }
    }
}).createMachine({
    context: ({ input }) => startingContext(input ?? context),
    id: 'completion',
    initial: 'active',
    output: ({ context }) => context.outcome === 'failed'
        ? { status: 'failure', error: context.failMessage ?? 'Completion failed' }
        : { status: 'success', response: context.response, metrics: context.metrics },
    on: {
        RECOVERY_REQUIRED: { target: '.paused', actions: 'recordRecovery' },
        OUTPUT: { actions: emit(({ event }) => event.event) },
        INPUT: { actions: 'queueInput' },
        FACTS: { actions: 'recordFacts' },
        'xstate.error.actor.*': [
            { guard: 'errorInPausing', target: '#completion.paused', actions: 'recordRecovery' },
            {
                guard: 'errorInActiveOrResumingAndRecoveryRequired',
                target: '#completion.pausing',
                actions: 'recordRecovery'
            },
            {
                guard: 'errorInActiveOrResumingAndInterrupted',
                target: '#completion.pausing',
                actions: 'recordPause'
            },
            {
                guard: 'errorInFinishing',
                target: '#completion.failed',
                actions: { type: 'failCompletion', params: errorParams }
            },
            {
                guard: 'errorInRoutableState',
                target: '#completion.active.finishing',
                actions: { type: 'failCompletion', params: errorParams }
            }
        ]
    },
    states: {
        active: {
            initial: 'idle',
            after: { deadline: { actions: 'markTimeUp' } },
            on: {
                PAUSE: { target: '#completion.pausing', actions: 'recordPause' },
                FAIL: [
                    {
                        guard: 'failInFinishing',
                        target: '#completion.failed',
                        actions: { type: 'failCompletion', params: ({ event }) => event.value }
                    },
                    {
                        target: '.finishing',
                        actions: { type: 'failCompletion', params: ({ event }) => event.value }
                    }
                ]
            },
            states: {
                history: { type: 'history', history: 'deep' },
                idle: {
                    tags: ['idle'],
                    on: { START: 'preparing' }
                },
                preparing: {
                    tags: ['running', 'preparing'],
                    invoke: {
                        src: 'preparing',
                        input: withParent,
                        onDone: [
                            {
                                guard: 'prepareNeeded',
                                target: 'prepareChecking',
                                actions: {
                                    type: 'requestPrepare',
                                    params: ({ event }) => ({
                                        preparation: event.output.preparation,
                                        step: selected(event.output.step)
                                    })
                                }
                            },
                            {
                                guard: 'directSearchNeeded',
                                target: 'searching',
                                actions: {
                                    type: 'queueDirectSearch',
                                    params: ({ event }) => event.output
                                }
                            },
                            {
                                target: 'round',
                                actions: {
                                    type: 'startInitialRound',
                                    params: ({ event }) => event.output.preparation
                                }
                            }
                        ]
                    }
                },
                prepareChecking: {
                    tags: ['running'],
                    invoke: {
                        src: 'inspectPrepare',
                        input: withParent,
                        onDone: [
                            {
                                guard: and(['prepareFailed', 'searchPending']),
                                target: 'searching',
                                actions: { type: 'settlePrepareFailure', params: ({ event }) => event.output }
                            },
                            {
                                guard: 'prepareFailed',
                                target: 'round',
                                actions: { type: 'settlePrepareFailure', params: ({ event }) => event.output }
                            },
                            {
                                target: 'prepareRunning',
                                actions: { type: 'authorizePrepare', params: ({ event }) => event.output }
                            }
                        ]
                    }
                },
                prepareRunning: {
                    tags: ['running'],
                    invoke: {
                        src: 'runPrepare',
                        input: withParent,
                        onDone: [
                            {
                                guard: and(['prepareFailed', 'searchPending']),
                                target: 'searching',
                                actions: { type: 'settlePrepareFailure', params: ({ event }) => event.output }
                            },
                            {
                                guard: 'prepareFailed',
                                target: 'round',
                                actions: { type: 'settlePrepareFailure', params: ({ event }) => event.output }
                            },
                            {
                                guard: 'searchPending',
                                target: 'searching',
                                actions: {
                                    type: 'settlePrepare',
                                    params: ({ event }) => selected(event.output)
                                }
                            },
                            {
                                target: 'round',
                                actions: {
                                    type: 'settlePrepare',
                                    params: ({ event }) => selected(event.output)
                                }
                            }
                        ]
                    }
                },
                searching: {
                    tags: ['running', 'preparing'],
                    invoke: {
                        src: 'searching',
                        input: withParent,
                        onDone: directToolRouting()
                    }
                },
                round: {
                    always: [
                        {
                            guard: 'timeUp',
                            target: 'wrapping',
                            actions: { type: 'wrapCompletion', params: 'time-capped' }
                        },
                        { target: 'generating' }
                    ]
                },
                generating: {
                    tags: ['running', 'streaming'],
                    invoke: {
                        src: 'generating',
                        input: withParent,
                        onDone: {
                            target: 'resolving',
                            actions: { type: 'finishRound', params: ({ event }) => event.output }
                        }
                    }
                },
                resolving: {
                    tags: ['running', 'tool-resolution'],
                    invoke: {
                        src: 'resolving',
                        input: withParent,
                        onDone: [
                            {
                                guard: 'roundHasToolCalls',
                                target: 'tools',
                                actions: { type: 'resolveTools', params: ({ event }) => event.output }
                            },
                            {
                                guard: and(['roundCut', or(['canRetryCut', 'timeUp'])]),
                                target: 'round',
                                actions: [nextRoundAck, 'retryCutRound']
                            },
                            {
                                guard: 'roundCut',
                                target: 'wrapping',
                                actions: [sameRoundAck, 'wrapCutCompletion']
                            },
                            {
                                guard: 'malformedToolCall',
                                target: 'round',
                                actions: { type: 'retryMalformedRound', params: ({ event }) => event.output }
                            },
                            {
                                guard: 'narratedIntent',
                                target: 'round',
                                actions: [
                                    nextRoundAck,
                                    { type: 'retryNarratedRound', params: ({ event }) => event.output }
                                ]
                            },
                            {
                                guard: 'hasAnswer',
                                target: 'answering'
                            },
                            {
                                guard: 'canMuteRetry',
                                target: 'round',
                                actions: [
                                    { type: 'resetCutRound', params: ({ event }) => event.output },
                                    { type: 'retryMuteRound', params: ({ event }) => event.output }
                                ]
                            },
                            {
                                target: 'wrapping',
                                actions: [
                                    { type: 'resetCutRound', params: ({ event }) => event.output },
                                    { type: 'wrapMuteCompletion', params: ({ event }) => event.output }
                                ]
                            }
                        ]
                    }
                },
                answering: {
                    tags: ['running', 'streaming'],
                    invoke: {
                        src: 'answering',
                        input: withParent,
                        onDone: [
                            {
                                guard: and(['hasInput', 'hasRoundsLeft', not('timeUp')]),
                                target: 'retrieving',
                                actions: [
                                    { type: 'answerCompletion', params: ({ event }) => event.output },
                                    'ackInput',
                                    'continueWithInput'
                                ]
                            },
                            {
                                guard: and(['stopContinues', 'hasRoundsLeft', not('timeUp')]),
                                target: 'round',
                                actions: [
                                    { type: 'answerCompletion', params: ({ event }) => event.output },
                                    { type: 'continueStop', params: ({ event }) => event.output }
                                ]
                            },
                            {
                                guard: and([
                                    'goalUnmet',
                                    'hasRoundsLeft',
                                    not('timeUp'),
                                    'goalTokensLeft',
                                    not('goalStalled')
                                ]),
                                target: 'round',
                                actions: [
                                    { type: 'answerCompletion', params: ({ event }) => event.output },
                                    'continueGoal'
                                ]
                            },
                            {
                                target: 'finishing',
                                actions: [
                                    { type: 'answerCompletion', params: ({ event }) => event.output },
                                    'settleGoal'
                                ]
                            }
                        ]
                    }
                },
                retrieving: {
                    tags: ['running', 'preparing'],
                    invoke: {
                        src: 'retrieving',
                        input: withParent,
                        onDone: {
                            target: 'round',
                            actions: { type: 'addKnowledge', params: ({ event }) => event.output }
                        }
                    }
                },
                tools: {
                    initial: 'selecting',
                    states: {
                        selecting: {
                            always: [
                                {
                                    guard: and(['hasQueuedTool', 'headCutOff']),
                                    target: 'rejecting',
                                    actions: {
                                        type: 'rejectCutOffTool',
                                        params: ({ context }) => context.toolQueue[0]
                                    }
                                },
                                {
                                    guard: and(['hasQueuedTool', 'repeatOfFailed']),
                                    target: 'rejecting',
                                    actions: {
                                        type: 'rejectRepeatedTool',
                                        params: ({ context }) => {
                                            const call = context.toolQueue[0];
                                            return {
                                                call,
                                                prior: context.failedCalls[call.key]
                                            };
                                        }
                                    }
                                },
                                { guard: and(['hasQueuedTool', 'readBatchQueued']), target: 'batching' },
                                {
                                    guard: 'hasQueuedTool',
                                    target: 'inspecting',
                                    actions: {
                                        type: 'selectNextTool',
                                        params: ({ context }) => context.toolQueue[0]
                                    }
                                },
                                { guard: 'toolAnswered', target: '#completion.active.answering' },
                                {
                                    guard: 'deliveredBefore',
                                    target: '#completion.active.wrapping',
                                    actions: [sameRoundAck, 'wrapDeliveredCompletion']
                                },
                                {
                                    guard: 'repeatsBlocked',
                                    target: '#completion.active.wrapping',
                                    actions: [sameRoundAck, 'wrapExhaustedCompletion']
                                },
                                {
                                    guard: and(['allResolvedToolsCapped', 'canRetrySearchCap', 'hasRoundsLeft']),
                                    target: '#completion.active.round',
                                    actions: [nextRoundAck, 'retryCappedSearch']
                                },
                                {
                                    guard: 'allResolvedToolsCapped',
                                    target: '#completion.active.wrapping',
                                    actions: [sameRoundAck, 'wrapSearchCappedCompletion']
                                },
                                {
                                    guard: 'hasRoundsLeft',
                                    target: '#completion.active.round',
                                    actions: [nextRoundAck, 'startNextRound']
                                },
                                {
                                    target: '#completion.active.wrapping',
                                    actions: [sameRoundAck, 'wrapExhaustedCompletion']
                                }
                            ]
                        },
                        batching: {
                            tags: ['running', 'tool'],
                            invoke: {
                                src: 'batching',
                                input: withParent,
                                onDone: [
                                    {
                                        guard: 'batchRan',
                                        target: 'selecting',
                                        actions: { type: 'finishBatch', params: ({ event }) => event.output }
                                    },
                                    {
                                        target: 'inspecting',
                                        actions: {
                                            type: 'selectNextTool',
                                            params: ({ context }) => context.toolQueue[0]
                                        }
                                    }
                                ]
                            }
                        },
                        inspecting: {
                            tags: ['running', 'tool'],
                            invoke: {
                                src: 'inspecting',
                                input: withParent,
                                onDone: [
                                    {
                                        guard: 'toolRejected',
                                        target: 'rejecting',
                                        actions: {
                                            type: 'rejectTool',
                                            params: ({ event }) => ({
                                                call: event.output.call,
                                                execution: event.output.execution,
                                                rejection: selected(event.output.rejection)
                                            })
                                        }
                                    },
                                    {
                                        guard: 'planModeWrite',
                                        target: 'rejecting',
                                        actions: {
                                            type: 'rejectPlanModeWrite',
                                            params: ({ event }) => ({
                                                call: event.output.call,
                                                execution: selected(event.output.execution)
                                            })
                                        }
                                    },
                                    {
                                        guard: {
                                            type: 'needsApproval',
                                            params: ({ event }) => event.output.execution
                                        },
                                        target: 'approving',
                                        actions: [
                                            {
                                                type: 'startTool',
                                                params: ({ event }) => selected(event.output.execution)
                                            },
                                            {
                                                type: 'requestApproval',
                                                params: ({ event }) => selected(event.output.execution).gate.call
                                            }
                                        ]
                                    },
                                    {
                                        guard: 'toolAutoRuns',
                                        target: 'executing',
                                        actions: {
                                            type: 'startTool',
                                            params: ({ event }) => selected(event.output.execution)
                                        }
                                    }
                                ]
                            }
                        },
                        rejecting: {
                            tags: ['running', 'tool'],
                            invoke: {
                                src: 'rejecting',
                                input: withParent,
                                onDone: [
                                    {
                                        guard: 'directExecution',
                                        target: '#completion.active.preparing',
                                        actions: { type: 'finishDirectTool', params: ({ event }) => event.output }
                                    },
                                    {
                                        target: 'selecting',
                                        actions: { type: 'finishTool', params: ({ event }) => event.output }
                                    }
                                ]
                            }
                        },
                        approving: {
                            tags: ['running', 'tool', 'approval'],
                            invoke: {
                                src: 'approving',
                                input: withParent,
                                onDone: [
                                    { guard: 'approved', target: 'executing', actions: 'approveCompletion' },
                                    {
                                        target: 'rejecting',
                                        actions: {
                                            type: 'rejectDeniedApproval',
                                            params: ({ context }) => selected({
                                                call: context.currentCall,
                                                execution: context.execution
                                            })
                                        }
                                    }
                                ]
                            }
                        },
                        executing: {
                            tags: ['running', 'tool'],
                            invoke: {
                                src: 'executing',
                                input: withParent,
                                onDone: [
                                    {
                                        guard: 'toolEndedRun',
                                        target: '#completion.active.finishing',
                                        actions: { type: 'endRunOnTool', params: ({ event }) => event.output }
                                    },
                                    {
                                        guard: 'directExecution',
                                        target: '#completion.active.preparing',
                                        actions: {
                                            type: 'finishDirectTool',
                                            params: ({ event }) => event.output
                                        }
                                    },
                                    {
                                        target: 'selecting',
                                        actions: { type: 'finishTool', params: ({ event }) => event.output }
                                    }
                                ]
                            }
                        }
                    }
                },
                wrapping: {
                    tags: ['running', 'streaming'],
                    invoke: {
                        src: 'wrapping',
                        input: withParent,
                        onDone: {
                            target: 'answering',
                            actions: { type: 'finishWrapRound', params: ({ event }) => event.output }
                        }
                    }
                },
                finishing: {
                    invoke: {
                        src: 'finishing',
                        input: withParent,
                        onDone: [
                            { guard: 'failedOutcome', target: '#completion.failed' },
                            { target: '#completion.done' }
                        ]
                    }
                }
            }
        },
        pausing: {
            tags: ['paused'],
            invoke: {
                src: 'cleanup',
                input: withParent,
                onDone: 'paused'
            }
        },
        resuming: {
            on: { PAUSE: { target: 'pausing', actions: 'recordPause' } },
            invoke: {
                src: 'resume',
                input: withParent,
                onDone: 'active.history'
            }
        },
        paused: {
            tags: ['paused'],
            on: { RESUME: { target: 'resuming', actions: 'resumeRun' } }
        },
        done: { type: 'final', tags: ['terminal', 'success'] },
        failed: { type: 'final', tags: ['terminal', 'error'] }
    }
});
export const createCompletionMachine = createCompletionMachineImplementation;
function clamp(ms) {
    return Math.min(MAX_DELAY, Math.max(0, ms));
}
function errorParams({ event }) {
    const error = tagError(event.error);
    if (error?.tag === 'failed') {
        return error;
    }
    return {
        error: error?.message ?? 'Completion failed',
        name: error?.name ?? 'Error'
    };
}
function startingContext(context) {
    if (!context) {
        throw new Error('A completion run starts from a context that carries its policy');
    }
    return JSON.parse(JSON.stringify(context));
}
