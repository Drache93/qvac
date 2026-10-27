export function toAsyncIterable(streamOrIterable) {
    if (!('on' in streamOrIterable))
        return streamOrIterable;
    const stream = streamOrIterable;
    const queue = [];
    let waiting = null;
    let ended = false;
    let error = null;
    const onData = (chunk) => {
        if (waiting) {
            const { resolve } = waiting;
            waiting = null;
            resolve({ value: chunk, done: false });
        }
        else {
            queue.push(chunk);
        }
    };
    const onEnd = () => {
        ended = true;
        if (waiting) {
            const { resolve } = waiting;
            waiting = null;
            resolve({ value: undefined, done: true });
        }
    };
    const onError = (err) => {
        error = err;
        if (waiting) {
            const { reject } = waiting;
            waiting = null;
            reject(err);
        }
    };
    stream.on('data', onData);
    stream.on('end', onEnd);
    stream.on('error', onError);
    const iterator = {
        [Symbol.asyncIterator]() {
            return iterator;
        },
        async return() {
            onEnd();
            queue.length = 0;
            stream.off?.('data', onData);
            stream.off?.('end', onEnd);
            stream.off?.('error', onError);
            return { done: true, value: undefined };
        },
        next() {
            if (!queue.length && !ended && !error) {
                stream.resume?.();
            }
            if (queue.length) {
                const [value] = queue.splice(0, 1);
                return Promise.resolve({ value, done: false });
            }
            if (ended) {
                return Promise.resolve({ value: undefined, done: true });
            }
            if (error) {
                return Promise.reject(error);
            }
            return new Promise((resolve, reject) => {
                waiting = { resolve, reject };
            });
        }
    };
    return iterator;
}
