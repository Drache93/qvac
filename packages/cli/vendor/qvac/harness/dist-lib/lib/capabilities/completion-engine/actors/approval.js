import { raceAbort } from '../../../helpers/race-abort.js';
import { detachJson } from '../../../helpers/detach-json.js';
export const approval = async function approval({ emit, input: { args, operations }, context, signal }) {
    const call = context.pendingCall;
    const approve = args.approve;
    if (!call || !approve) {
        return { approved: false };
    }
    const currentCall = context.currentCall;
    const rawCall = context.currentCall?.rawCall;
    emit({
        type: 'tool-call',
        name: call.name,
        args: call.arguments,
        rawCall,
        effect: call.effect ?? 'write',
        display: call.display ?? undefined
    });
    const id = `${context.runId}:round-${context.round}:${currentCall?.id ?? call.name}:approve`;
    const approved = await operations.operation({ id, name: 'human:approve', args: call.arguments, effect: 'read' }, () => raceAbort(raceAbort(approve({
        ...call,
        arguments: detachJson(call.arguments),
        resource: detachJson(call.resource),
        display: detachJson(call.display),
        callId: currentCall?.id,
        round: context.round
    }), args.signal), signal), undefined, signal);
    return { approved };
};
