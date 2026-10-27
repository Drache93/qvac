export async function* bufferBurst(tokens, ms) {
    const deadline = Date.now() + ms;
    let burst = '';
    for await (const token of tokens) {
        if (burst === null) {
            yield token;
            continue;
        }
        if (Date.now() >= deadline) {
            if (burst) {
                yield burst;
            }
            burst = null;
            yield token;
            continue;
        }
        burst += token;
    }
    if (burst) {
        yield burst;
    }
}
