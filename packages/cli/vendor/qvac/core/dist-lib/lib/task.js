import { CoreError } from './errors.js';
const SETTLED_STATES = new Set([
    'completed',
    'failed',
    'canceled',
    'paused',
    'recovery-required'
]);
const TITLE_CHARS = 60;
export async function runTask(engine, request) {
    const { agentId, meshId, prompt, skill } = request;
    const text = skill ? `@${skill} ${prompt}` : prompt;
    const { chatId, runId } = await engine.sendMessage({
        text,
        agentId,
        meshId,
        chatId: request.chatId ?? null,
        title: request.chatId ? null : title(prompt),
        capability: request.capability ?? null,
        capabilityArgs: request.capabilityArgs ?? null,
        enhance: request.enhance ?? null
    });
    for await (const frame of engine.chunksWatch({ chatId, meshId })) {
        const chunks = frame.chunks ?? [];
        const state = terminalState(chunks, runId);
        if (state) {
            return collect(chunks, { chatId, runId, state });
        }
    }
    throw new CoreError('RUN_STREAM_ENDED', [chatId]);
}
function terminalState(chunks, runId) {
    for (const chunk of chunks) {
        const state = chunk.runId === runId ? chunk.runStatus?.state : undefined;
        if (state && SETTLED_STATES.has(state)) {
            return state;
        }
    }
    return null;
}
function collect(all, { chatId, runId, state }) {
    const chunks = all.filter((chunk) => chunk.runId === runId);
    const text = [];
    const thinking = [];
    const toolCalls = [];
    const attachments = [];
    const sources = [];
    let reason = null;
    let metrics = null;
    for (const chunk of chunks) {
        const call = chunk.toolCall;
        if (chunk.type === 'tool-result') {
            text.length = 0;
        }
        if (chunk.content) {
            text.push(chunk.content.text);
        }
        if (chunk.thinking) {
            thinking.push(chunk.thinking.text);
        }
        if (call) {
            toolCalls.push({ name: call.name, arguments: call.arguments });
        }
        if (chunk.attachment && !chunk.attachment.deletedAt && !chunk.sourceId) {
            attachments.push(chunk.attachment);
        }
        if (chunk.sources) {
            sources.push(...chunk.sources.sources);
        }
        if (chunk.runStatus?.reason) {
            reason = chunk.runStatus.reason;
        }
        if (chunk.runStatus?.metrics) {
            metrics = chunk.runStatus.metrics;
        }
    }
    return {
        chatId,
        runId,
        state,
        text: text.join('').trim(),
        thinking: thinking.join('').trim(),
        toolCalls,
        attachments,
        sources,
        reason,
        metrics,
        chunks
    };
}
function title(prompt) {
    const line = prompt.trim().split('\n', 1)[0] ?? '';
    return line.length > TITLE_CHARS ? `${line.slice(0, TITLE_CHARS)}…` : line;
}
