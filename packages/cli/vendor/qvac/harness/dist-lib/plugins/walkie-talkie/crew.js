export function crew(roster, { attach, receive } = {}) {
    const out = new Map();
    const controller = new AbortController();
    let next = 0;
    const send = async (args, ctx) => {
        ctx?.signal?.addEventListener('abort', () => controller.abort(), { once: true });
        const attachments = attach ? await attach(ctx) : {};
        const sent = messagesOf(args).map(({ to, text }) => {
            const id = `m${++next}`;
            const done = roster.send(to, { text, attachments }, controller.signal).then(async (reply) => {
                const extra = receive ? await receive(reply, to, ctx) : null;
                return {
                    id,
                    to,
                    status: reply.status,
                    reply: [reply.text, extra].filter(Boolean).join('\n\n')
                };
            });
            out.set(id, { id, to, done });
            return { id, to };
        });
        return { sent, waiting: out.size };
    };
    const wait = async () => {
        if (out.size === 0) {
            return { replies: [], waiting: [], note: 'No message is waiting for a reply.' };
        }
        await Promise.race([...out.values()].map((it) => it.done));
        const replies = [];
        for (const it of [...out.values()]) {
            const settled = await Promise.race([it.done, Promise.resolve(null)]);
            if (settled) {
                replies.push(settled);
                out.delete(it.id);
            }
        }
        return { replies, waiting: [...out.values()].map(({ id, to }) => ({ id, to })) };
    };
    return {
        tools: [sendTool(roster.agents(), send), waitTool(wait)],
        stop: () => controller.abort()
    };
}
function sendTool(agents, execute) {
    const names = agents.map((agent) => agent.name);
    const listed = agents.map((agent) => `- ${agent.name}: ${agent.description}`).join('\n');
    return {
        name: 'team_send',
        toolset: 'team',
        description: "Send messages to agents on the team, on this machine or a teammate's. This returns their " +
            'ids at once; each reply comes back through team_wait. An agent sees only your message, ' +
            'never this conversation, so say everything it needs. Send several at once to have them ' +
            `work side by side. Agents:\n${listed}`,
        parameters: {
            type: 'object',
            properties: {
                messages: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            to: { type: 'string', enum: names, description: 'The agent it is for' },
                            text: { type: 'string', description: 'The whole request' }
                        },
                        required: ['to', 'text']
                    }
                }
            },
            required: ['messages']
        },
        externalWrite: true,
        effect: () => 'write',
        quote: (args) => messagesOf(args)
            .map((m) => `→ ${m.to}: ${m.text}`)
            .join('\n'),
        validate: (args) => {
            const messages = messagesOf(args);
            return messages.length > 0 && messages.every((m) => names.includes(m.to) && m.text)
                ? null
                : `messages must be a non-empty array of { to, text }, to one of ${names.join(', ')}`;
        },
        execute
    };
}
function waitTool(execute) {
    return {
        name: 'team_wait',
        toolset: 'team',
        description: 'Wait for replies to the messages you sent. This returns as soon as any arrive, with the ' +
            'ones still out; act on each reply straight away rather than waiting for them all.',
        parameters: { type: 'object', properties: {} },
        autoApprove: true,
        effect: () => 'read',
        execute
    };
}
function messagesOf(args) {
    const messages = Array.isArray(args.messages) ? args.messages : [];
    return messages.map((item) => {
        const { to, text } = Object(item);
        return { to: String(to ?? ''), text: String(text ?? '') };
    });
}
