import { assign, createActor, fromPromise, setup, waitFor } from 'xstate';
import { errorMessage, isRecord } from '../guards.js';
import { HarnessLog } from '../log.js';
function errorFromEvent(event) {
    return isRecord(event) ? event.error : undefined;
}
function requestFromEvent(event) {
    return event.type === 'SUSPEND' || event.type === 'RESUME' || event.type === 'WAKEUP'
        ? event.type
        : null;
}
export const harnessLifecycle = setup({
    types: {},
    actors: {
        suspend: fromPromise(async () => { }),
        resume: fromPromise(async () => { })
    },
    actions: {
        hold: assign(({ event }) => ({ pending: requestFromEvent(event) })),
        clear: assign({ pending: null }),
        report: ({ event }) => {
            HarnessLog.info('lifecycle step failed', { err: errorMessage(errorFromEvent(event)) });
        },
        recordError: assign(({ context, event }) => {
            const message = errorMessage(errorFromEvent(event));
            return {
                failureCount: context.failureCount + 1,
                failureMessage: message
            };
        })
    },
    guards: {
        resumeHeld: ({ context }) => context.pending === 'RESUME',
        wakeupHeld: ({ context }) => context.pending === 'WAKEUP',
        suspendHeld: ({ context }) => context.pending === 'SUSPEND'
    }
}).createMachine({
    id: 'harness',
    context: { pending: null, failureCount: 0, failureMessage: null },
    initial: 'running',
    states: {
        running: {
            always: { guard: 'suspendHeld', target: 'suspending', actions: 'clear' },
            on: { PRESUSPEND: 'presuspended', SUSPEND: 'suspending' }
        },
        presuspended: {
            on: { RESUME: 'running', WAKEUP: 'running', SUSPEND: 'suspending' }
        },
        suspending: {
            tags: ['busy', 'suspended'],
            invoke: {
                src: 'suspend',
                onDone: 'suspended',
                onError: { target: 'suspended', actions: ['report', 'recordError'] }
            },
            on: {
                RESUME: { actions: 'hold' },
                WAKEUP: { actions: 'hold' },
                SUSPEND: { actions: 'clear' },
                CLOSE: { actions: 'clear' }
            }
        },
        suspended: {
            tags: ['suspended'],
            always: [
                { guard: 'resumeHeld', target: 'resuming', actions: 'clear' },
                { guard: 'wakeupHeld', target: 'waking', actions: 'clear' }
            ],
            on: { RESUME: 'resuming', WAKEUP: 'waking' }
        },
        resuming: {
            tags: ['busy'],
            invoke: {
                src: 'resume',
                onDone: 'running',
                onError: { target: 'suspended', actions: ['report', 'recordError', 'clear'] }
            },
            on: {
                SUSPEND: { actions: 'hold' },
                RESUME: { actions: 'clear' },
                WAKEUP: { actions: 'clear' },
                CLOSE: { actions: 'clear' }
            }
        },
        waking: {
            tags: ['busy'],
            invoke: {
                src: 'resume',
                onDone: 'running',
                onError: { target: 'suspended', actions: ['report', 'recordError', 'clear'] }
            },
            on: {
                SUSPEND: { actions: 'hold' },
                RESUME: { actions: 'clear' },
                WAKEUP: { actions: 'clear' },
                CLOSE: { actions: 'clear' }
            }
        }
    }
});
export function createHarnessLifecycle(work) {
    const actor = createActor(harnessLifecycle.provide({
        actors: {
            suspend: fromPromise(() => work.suspend()),
            resume: fromPromise(() => work.resume())
        }
    })).start();
    const settled = () => waitFor(actor, (snapshot) => !snapshot.hasTag('busy'));
    return {
        get suspended() {
            return actor.getSnapshot().hasTag('suspended');
        },
        get state() {
            return actor.getSnapshot().value;
        },
        async send(type) {
            const failureCount = actor.getSnapshot().context.failureCount;
            actor.send({ type });
            await settled();
            const { context } = actor.getSnapshot();
            if (context.failureCount !== failureCount) {
                throw new Error(context.failureMessage ?? 'Harness lifecycle step failed');
            }
        },
        settled,
        cancelPending: () => actor.send({ type: 'CLOSE' }),
        stop: () => actor.stop()
    };
}
