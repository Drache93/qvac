import { copy } from '../helpers/copy.js';
import { createCompletionMachine } from './completion/machine.js';
export function transitionName(named) {
    if (typeof named === 'string')
        return named;
    if (named && (typeof named === 'object' || typeof named === 'function')) {
        const guards = Reflect.get(named, 'guards');
        const name = Reflect.get(named, 'name');
        const type = Reflect.get(named, 'type');
        if (Array.isArray(guards)) {
            return `${typeof name === 'string' ? name : 'inline'}(${guards
                .map(transitionName)
                .join(', ')})`;
        }
        if (typeof type === 'string') {
            return type;
        }
        if (typeof name === 'string') {
            return name;
        }
    }
    return 'inline';
}
function nameOf(named) {
    return transitionName(named);
}
function stripTransition(transition) {
    const out = { eventType: transition.eventType };
    if (transition.target?.length) {
        out.target = transition.target.map((node) => node.id);
    }
    if (transition.guard) {
        out.guard = nameOf(transition.guard);
    }
    if (transition.actions.length) {
        out.actions = transition.actions.map(nameOf);
    }
    return out;
}
let cachedDefinition;
function machineDefinition() {
    cachedDefinition ??= stripNode(createCompletionMachine().root);
    return cachedDefinition;
}
export function completionMachineDefinition() {
    return copy(machineDefinition());
}
function stripNode(node) {
    const out = {
        id: node.id,
        type: node.type,
        tags: [...node.tags],
        entry: node.entry.map(nameOf),
        exit: node.exit.map(nameOf),
        invoke: node.invoke.map((invoke) => ({
            id: invoke.id,
            src: typeof invoke.src === 'string' ? invoke.src : nameOf(invoke.src)
        }))
    };
    const initial = node.initial?.target?.[0]?.id;
    if (initial) {
        const prefix = `${node.id}.`;
        out.initial = initial.startsWith(prefix) ? initial.slice(prefix.length) : initial;
    }
    const children = Object.entries(node.states);
    if (children.length) {
        out.states = Object.fromEntries(children.map(([key, child]) => [key, stripNode(child)]));
    }
    if (node.transitions.size) {
        out.on = Object.fromEntries([...node.transitions].map(([event, list]) => [event, list.map(stripTransition)]));
    }
    if (node.always?.length) {
        out.always = node.always.map(stripTransition);
    }
    return out;
}
