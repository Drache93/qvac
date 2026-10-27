export const TRANSFER_TOOL_NAME = 'transfer_to_agent';
export function createTransferTool(handoffs) {
    const ids = handoffs.map((handoff) => handoff.id);
    const roster = handoffs.map((handoff) => `- ${handoff.id}: ${handoff.description}`).join('\n');
    return {
        name: TRANSFER_TOOL_NAME,
        toolset: null,
        description: 'Hand the conversation to another agent that is better suited to it. The other agent ' +
            `answers the user next; do not answer yourself after transferring. Agents:\n${roster}`,
        parameters: {
            type: 'object',
            properties: {
                agent: { type: 'string', enum: ids, description: 'The agent to hand to' },
                reason: { type: 'string', description: 'What the user needs, in one sentence' }
            },
            required: ['agent', 'reason']
        },
        autoApprove: true,
        endsRun: true,
        effect: () => 'read',
        validate: (args) => typeof args.agent === 'string' && ids.includes(args.agent)
            ? null
            : `agent must be one of ${ids.join(', ')}`,
        execute: (args) => Promise.resolve({ transferred: String(args.agent), reason: String(args.reason ?? '') })
    };
}
