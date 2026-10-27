export function createInferenceCallsApi(reader) {
    return {
        inferenceCalls: async ({ chatId, meshId }) => {
            const answer = await reader.list(meshId, chatId);
            return {
                calls: answer.calls.map((entry) => ({
                    runId: entry.runId,
                    at: entry.at,
                    call: entry.call
                })),
                truncated: answer.truncated
            };
        }
    };
}
