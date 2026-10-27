export function createEmbedLane() {
    let tail = Promise.resolve();
    return (sdk, { modelId, texts }) => {
        const job = tail.then(async () => {
            if (texts.length === 0)
                return [];
            const { embedding } = await sdk.embed({ modelId, text: texts });
            return embedding;
        });
        tail = job.catch(noop);
        return job;
    };
}
function noop() { }
