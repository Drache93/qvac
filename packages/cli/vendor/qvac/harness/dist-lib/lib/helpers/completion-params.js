function isSdkMessage(turn) {
    return turn.toolCalls !== null && turn.toolCallId !== null;
}
export function completionParams({ modelId, history, tools, generationParams, responseFormat, toolDialect, kvCache }) {
    return {
        modelId,
        history: history.map((turn) => isSdkMessage(turn)
            ? turn
            : {
                ...turn,
                toolCalls: turn.toolCalls ?? undefined,
                toolCallId: turn.toolCallId ?? undefined
            }),
        stream: true,
        tools,
        generationParams,
        responseFormat,
        toolDialect,
        kvCache
    };
}
