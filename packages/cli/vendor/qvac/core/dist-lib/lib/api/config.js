import { watchable } from './watchable.js';
export function createConfigApi(state, log, onset = null) {
    return {
        async configGet({ key }) {
            return { value: await state.get(key) };
        },
        async configSet({ key, value }) {
            await state.set(key, value);
            onset?.(key);
            return { ok: true };
        },
        configWatch: watchable(() => state, async ({ key }) => ({
            value: await state.get(key)
        }), { name: 'configWatch', log })
    };
}
