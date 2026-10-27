import { toAsyncIterable } from '../core/async-iterable.js';
export async function openUpload(frames) {
    const iterator = toAsyncIterable(frames)[Symbol.asyncIterator]();
    const first = await iterator.next();
    if (first.done) {
        return null;
    }
    const rest = replay(first.value, iterator);
    if ('writeStream' in frames) {
        Object.assign(rest, { writeStream: frames.writeStream });
    }
    return { first: first.value, rest };
}
async function* replay(first, rest) {
    yield first;
    yield* { [Symbol.asyncIterator]: () => rest };
}
