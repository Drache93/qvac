const MIN_REPEAT_CHARS = 16;
function doubled(text) {
    if (text.length < MIN_REPEAT_CHARS * 2 || text.length % 2) {
        return false;
    }
    const half = text.length / 2;
    return text.slice(0, half) === text.slice(half);
}
function halve(text) {
    return doubled(text) ? text.slice(0, text.length / 2) : text;
}
function firstHalf(items, key) {
    const half = items.length / 2;
    if (items.length % 2) {
        return items;
    }
    const repeats = items.slice(half).every((item, at) => key(item) === key(items[at]));
    return repeats ? items.slice(0, half) : items;
}
async function* withoutRepeatedTail(events) {
    let streamed = '';
    let held = [];
    let heldText = '';
    for await (const event of events) {
        if (event.type !== 'contentDelta') {
            yield event;
            continue;
        }
        if (heldText && streamed.startsWith(heldText + event.text)) {
            held.push(event);
            heldText += event.text;
            continue;
        }
        if (heldText) {
            yield* held;
            streamed += heldText;
            held = [];
            heldText = '';
        }
        if (streamed.length >= MIN_REPEAT_CHARS && event.text && streamed.startsWith(event.text)) {
            held = [event];
            heldText = event.text;
            continue;
        }
        streamed += event.text;
        yield event;
    }
    if (heldText && heldText !== streamed) {
        yield* held;
    }
}
function once(reply) {
    if (!doubled(reply.raw.fullText)) {
        return reply;
    }
    return {
        ...reply,
        contentText: halve(reply.contentText),
        thinkingText: reply.thinkingText && halve(reply.thinkingText),
        raw: { ...reply.raw, fullText: halve(reply.raw.fullText) },
        toolCalls: firstHalf(reply.toolCalls, ({ name, arguments: args }) => JSON.stringify([name, args])),
        toolErrors: reply.toolErrors &&
            firstHalf(reply.toolErrors, ({ code, message, raw }) => JSON.stringify([code, message, raw]))
    };
}
export function withoutRepeatedReply(result) {
    const final = result.final.then(once);
    final.catch(noop);
    return { ...result, events: withoutRepeatedTail(result.events), final };
}
function noop() { }
