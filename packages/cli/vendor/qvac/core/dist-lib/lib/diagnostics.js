import * as z from 'zod';
const BACKEND_USES_KEPT = 5;
const RunBackendUse = z.object({
    tool: z.string(),
    requestedGpu: z.boolean(),
    device: z.string(),
    backend: z.string()
});
export function recordBackends(into, backends) {
    if (!Array.isArray(backends)) {
        return;
    }
    for (const raw of backends) {
        const parsed = RunBackendUse.safeParse(raw);
        if (!parsed.success) {
            continue;
        }
        const { tool, requestedGpu, device, backend } = parsed.data;
        const uses = [...(into.get(tool) ?? []), { requestedGpu, device, backend }];
        into.set(tool, uses.slice(-BACKEND_USES_KEPT));
    }
}
export function summarizeRuns(runs, suspended) {
    const list = [];
    const chats = new Set();
    for (const { runId, chatId, model } of runs) {
        list.push({ runId, chatId, model });
        chats.add(chatId);
    }
    return {
        suspended,
        runs: list,
        activeChats: chats.size,
        queued: list.length - chats.size
    };
}
