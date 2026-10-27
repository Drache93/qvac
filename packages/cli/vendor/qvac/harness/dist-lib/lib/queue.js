export function pushQueue({ highWaterMark = 0 } = {}) {
    const items = [];
    let wake = null;
    let drain = null;
    let ended = false;
    const wakeConsumer = () => {
        wake?.resolve();
        wake = null;
    };
    const wakeProducer = () => {
        drain?.resolve();
        drain = null;
    };
    return {
        get size() {
            return items.length;
        },
        push(item) {
            if (ended) {
                return Promise.resolve();
            }
            items.push(item);
            wakeConsumer();
            if (highWaterMark <= 0 || items.length < highWaterMark) {
                return Promise.resolve();
            }
            drain ??= Promise.withResolvers();
            return drain.promise;
        },
        end() {
            ended = true;
            wakeConsumer();
            wakeProducer();
        },
        async *[Symbol.asyncIterator]() {
            while (true) {
                while (items.length) {
                    const item = items[0];
                    items.shift();
                    if (highWaterMark > 0 && items.length < highWaterMark) {
                        wakeProducer();
                    }
                    yield item;
                }
                if (ended) {
                    return;
                }
                wake = Promise.withResolvers();
                await wake.promise;
            }
        }
    };
}
