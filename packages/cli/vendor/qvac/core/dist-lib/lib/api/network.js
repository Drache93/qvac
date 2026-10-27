import { watchable } from './watchable.js';
export function createNetworkApi(source, log) {
    return {
        networkWatch: watchable(() => source, async () => source.snapshot(), { name: 'networkWatch', log })
    };
}
export function createBlindPeeringApi(source, log) {
    return {
        setBlindPeering: ({ enabled }) => source.set(enabled === true),
        blindPeeringWatch: watchable(() => source, async () => source.snapshot(), { name: 'blindPeeringWatch', log })
    };
}
