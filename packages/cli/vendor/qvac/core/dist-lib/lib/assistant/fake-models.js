import b4a from 'b4a';
import crypto from 'hypercore-crypto';
import ScopeLock from 'scope-lock';
import { FAKE_MODELS_KEY, QUACK_MODEL } from '../constants.js';
import { errorMessage } from '../guards.js';
export const MAX_QUACKS = 500;
const QUACK_ROW = {
    name: QUACK_MODEL,
    type: 'llm',
    taskType: 'llm',
    registryPath: QUACK_MODEL,
    registrySource: 'fake',
    isCached: true,
    isLoaded: true,
    expectedSize: 0,
    supportsImages: false
};
export function quackCount(prompt) {
    return 1 + (b4a.readUInt32LE(crypto.hash(b4a.from(prompt)), 0) % MAX_QUACKS);
}
export async function readFakeModels(state) {
    return (await state.get(FAKE_MODELS_KEY)) === true;
}
export function watchFakeModels(state, opts) {
    const { onChange, logger } = opts;
    const lock = new ScopeLock({ debounce: true });
    let disposed = false;
    let reported = opts.initial;
    const schedule = async () => {
        if (disposed || !(await lock.lock()))
            return;
        try {
            const enabled = await readFakeModels(state);
            if (!disposed && enabled !== reported) {
                reported = enabled;
                onChange(enabled);
            }
        }
        catch (err) {
            logger?.warn('fake-models', 'reading the switch failed', errorMessage(err));
        }
        finally {
            lock.unlock();
        }
    };
    const listener = () => void schedule();
    state.watch(listener);
    return async () => {
        disposed = true;
        state.unwatch(listener);
        lock.destroy();
        await lock.flush();
    };
}
export function withFakeModels(harness, opts = {}) {
    const { enabled = () => true, paceMs = 10 } = opts;
    const isQuack = (model) => model === QUACK_MODEL && enabled();
    const quacking = {
        ...modelCalls(harness, isQuack),
        completion: (context) => isQuack(context.model) ? quack(context, paceMs) : harness.completion(context)
    };
    return new Proxy(harness, {
        get(target, key) {
            if (Object.hasOwn(quacking, key)) {
                return Reflect.get(quacking, key);
            }
            const value = Reflect.get(target, key);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    });
}
function modelCalls(harness, isQuack) {
    const list = harness.list?.bind(harness);
    const warmModel = harness.warmModel?.bind(harness);
    const loadModel = harness.loadModel?.bind(harness);
    const unloadModel = harness.unloadModel?.bind(harness);
    const deleteModel = harness.deleteModel?.bind(harness);
    return {
        list: list &&
            (async (options) => {
                const rows = await list(options);
                return isQuack(QUACK_MODEL) ? withQuackRow(rows, options?.type) : rows;
            }),
        warmModel: warmModel && ((context) => (isQuack(context.model) ? Promise.resolve() : warmModel(context))),
        loadModel: loadModel &&
            ((context) => isQuack(context.model) ? Promise.resolve({ loaded: true }) : loadModel(context)),
        unloadModel: unloadModel &&
            ((context) => isQuack(context.model) ? Promise.resolve({ unloaded: true }) : unloadModel(context)),
        deleteModel: deleteModel &&
            ((name) => isQuack(name) ? Promise.resolve({ name, removed: 0, freedBytes: 0 }) : deleteModel(name))
    };
}
function withQuackRow(rows, type) {
    return type && type !== 'llm' ? rows : [...rows, QUACK_ROW];
}
async function* quack(context, paceMs) {
    const prompt = context.messages.findLast((turn) => turn.role === 'user')?.content ?? '';
    const count = quackCount(prompt);
    for (let i = 0; i < count; i++) {
        if (i > 0) {
            await pace(paceMs);
        }
        if (context.signal?.aborted) {
            yield { type: 'aborted' };
            return;
        }
        yield { type: 'content', text: i === 0 ? 'quack' : ' quack' };
    }
}
function pace(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
