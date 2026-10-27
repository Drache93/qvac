export function isVadEvent(event) {
    return (!Array.isArray(event) &&
        event.type === 'vad' &&
        typeof event.speaking === 'boolean' &&
        typeof event.score === 'number' &&
        (event.source === 'silero' || event.source === 'energy' || event.source === 'sortformer'));
}
export function isEndOfTurnEvent(event) {
    return (!Array.isArray(event) &&
        event.type === 'endOfTurn' &&
        (event.source === 'vad-silence' || event.source === 'model-eou'));
}
export function toVadStateEvent(event) {
    return {
        speaking: event.speaking,
        probability: event.score,
        source: event.source,
        ...(event.speakerId !== undefined && { speakerId: event.speakerId })
    };
}
export function toEndOfTurnEvent(event) {
    if (event.source === 'model-eou') {
        return { source: 'parakeet' };
    }
    if (event.silenceDurationMs === undefined) {
        return null;
    }
    return {
        source: 'whisper',
        silenceDurationMs: event.silenceDurationMs
    };
}
