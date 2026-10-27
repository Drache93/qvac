export function requestApproval({ context, params: call }) {
    const facts = context.execution?.gate?.facts;
    if (!facts) {
        throw new Error('Cannot request approval without tool preflight facts');
    }
    return {
        pendingCall: call,
        approval: { status: 'pending', key: facts.key }
    };
}
export function approveCompletion({ context }) {
    return {
        pendingCall: null,
        approval: { ...context.approval, status: 'approved' }
    };
}
