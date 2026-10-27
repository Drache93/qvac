import { spliceFrom } from '../splice.js';
import { executionPlan } from './execution-plan.js';
import { inspectCall } from './inspecting.js';
import { runCall, settleCall } from './executing.js';
import { CompletionMachine } from '../../../machine/index.js';
const MAX_BATCH = 4;
export const batching = async function batching(input) {
    const { input: deps, context } = input;
    const members = batchMembers(deps, context);
    if (members.length < 2) {
        return { results: [] };
    }
    const order = modelOrder(input.emit, members.map((member) => member.call.id));
    const running = members.map(async (member, at) => {
        try {
            const plan = executionPlan(deps, context, member);
            const emit = order.emitFor(at);
            return { ran: await runCall(input, { plan, execution: member.execution, emit }) };
        }
        catch (error) {
            return { error };
        }
    });
    const results = [];
    const entries = [];
    for (let at = 0; at < members.length; at++) {
        order.open(at);
        const settled = await running[at];
        if ('error' in settled) {
            order.close();
            await Promise.all(running);
            throw settled.error;
        }
        const { entry, ...result } = settleCall(input, {
            ran: settled.ran,
            direct: false,
            emit: order.emitFor(at)
        });
        results.push(result);
        entries.push(entry);
    }
    return { history: spliceFrom(context.history, [...context.history, ...entries]), results };
};
function modelOrder(emit, ids) {
    let turn = 0;
    const held = ids.map(() => []);
    return {
        emitFor: (at) => (event) => {
            const stamped = { ...event, callId: ids[at] };
            if (at === turn) {
                emit(stamped);
            }
            else {
                held[at].push(stamped);
            }
        },
        open(at) {
            turn = at;
            for (const event of held[at].splice(0)) {
                emit(event);
            }
        },
        close() {
            turn = -1;
        }
    };
}
function batchMembers(deps, context) {
    const members = [];
    for (const call of context.toolQueue) {
        if (members.length === MAX_BATCH ||
            !call.concurrent ||
            call.cutOff ||
            context.failedCalls[call.key] ||
            members.some((member) => member.call.key === call.key)) {
            break;
        }
        const { rejection, execution } = inspectCall(deps, context, call);
        const facts = execution?.gate?.facts;
        if (rejection ||
            !execution ||
            facts?.effect !== 'read' ||
            !CompletionMachine.runsUnasked(facts) ||
            execution.origin === 'skill' ||
            execution.webSearch) {
            break;
        }
        members.push({ call, execution });
    }
    return members;
}
