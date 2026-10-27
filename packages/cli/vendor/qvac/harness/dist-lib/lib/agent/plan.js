export const PLAN_TOOL_NAME = 'update_plan';
export const MAX_PLAN_STEPS = 12;
const STATUSES = ['pending', 'in_progress', 'done'];
const PARAMETERS = {
    type: 'object',
    properties: {
        steps: {
            type: 'array',
            description: `At most ${MAX_PLAN_STEPS} steps, one line each`,
            items: {
                type: 'object',
                properties: {
                    step: { type: 'string' },
                    status: { type: 'string', enum: [...STATUSES] }
                },
                required: ['step', 'status']
            }
        },
        submit: { type: 'boolean', description: 'Plan mode only: ask the user to approve the plan' }
    },
    required: ['steps']
};
function isStep(value) {
    const { step, status } = Object(value);
    return typeof step === 'string' && step.trim() !== '' && STATUSES.includes(status);
}
function planError(args) {
    const { steps, submit } = args;
    if (!Array.isArray(steps) || !steps.length || !steps.every(isStep)) {
        return `steps must be a list of 1 to ${MAX_PLAN_STEPS} items, each { step, status } with status pending, in_progress or done`;
    }
    if (steps.length > MAX_PLAN_STEPS) {
        return `a plan holds at most ${MAX_PLAN_STEPS} steps; merge some`;
    }
    if (steps.filter((step) => step.status === 'in_progress').length > 1) {
        return 'only one step may be in_progress at a time';
    }
    return submit === undefined || typeof submit === 'boolean' ? null : 'submit must be true or false';
}
export function planSteps(args) {
    const steps = Array.isArray(args.steps) ? args.steps : [];
    return steps
        .filter(isStep)
        .map(({ step, status }) => ({ step: step.replace(/\s+/g, ' ').trim(), status }));
}
export function planFromMessages(messages) {
    const call = messages
        .flatMap((message) => message.toolCalls ?? [])
        .findLast((entry) => entry.name === PLAN_TOOL_NAME && !planError(entry.arguments));
    const steps = call ? planSteps(call.arguments) : [];
    return steps.every((step) => step.status === 'done') ? [] : steps;
}
export function createPlanTool() {
    const submits = (args, ctx) => ctx?.planMode === true && args.submit === true;
    return {
        name: PLAN_TOOL_NAME,
        toolset: null,
        description: 'Keep a short plan for a request that takes several steps. Each call replaces the whole ' +
            'list: mark the step you are on in_progress and finished ones done. You see the plan ' +
            'after each tool round. In plan mode writes are refused until the user approves: send ' +
            'the plan with submit true to ask them.',
        parameters: PARAMETERS,
        effect: (args, ctx) => (submits(args, ctx) ? 'write' : 'read'),
        validate: planError,
        quote: (args) => planError(args)
            ? null
            : planSteps(args)
                .map(({ step }, at) => `${at + 1}. ${step}`)
                .join('\n'),
        execute: (args, ctx) => Promise.resolve({
            content: submits(args, ctx) ? 'Plan approved. Carry it out.' : 'Plan saved.'
        })
    };
}
