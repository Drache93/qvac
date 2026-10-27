import { SKILL_STATE } from './skill-state.js';
export function deriveSetup(entry, state) {
    if (!entry.setup)
        return undefined;
    return {
        ...entry.setup,
        routes: entry.setup.routes?.map((route) => withSatisfied(route, state))
    };
}
function withSatisfied(route, state) {
    return route.kind === 'install' ? { ...route, satisfied: state === SKILL_STATE.ready } : route;
}
