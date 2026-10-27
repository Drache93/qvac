const KINDS = { final: 'final', history: 'history' };
const CHAR = 7.4;
const LINE = 15;
const OPTIONS = {
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.spacing.nodeNodeBetweenLayers': '36',
    'elk.spacing.nodeNode': '32',
    'elk.spacing.edgeNode': '16',
    'elk.spacing.edgeEdge': '10',
    'elk.layered.spacing.edgeNodeBetweenLayers': '16',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
    'elk.edgeLabels.placement': 'CENTER',
    'elk.edgeLabels.inline': 'true',
    'elk.layered.edgeLabels.sideSelection': 'SMART_DOWN'
};
export async function layout(definition, ran) {
    const graph = new Graph(definition);
    graph.walk(definition);
    const { nodes, edges } = ran ? only(graph, ran) : graph;
    const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
    const laid = await new ELK().layout({
        id: '__root',
        layoutOptions: OPTIONS,
        children: [...nodes.values()].map((node) => ({
            id: node.id,
            width: node.w,
            height: node.h
        })),
        edges: edges.map((edge, index) => ({
            id: String(index),
            sources: [edge.source],
            targets: [edge.target],
            labels: edge.event ? [{ text: edge.key, ...labelSize(edge) }] : []
        }))
    });
    for (const child of laid.children ?? []) {
        Object.assign(nodes.get(child.id) ?? {}, { x: child.x, y: child.y });
    }
    for (const laidEdge of laid.edges ?? []) {
        route(edges[Number(laidEdge.id)], laidEdge);
    }
    return {
        w: laid.width ?? 0,
        h: laid.height ?? 0,
        nodes: [...nodes.values()],
        edges: edges.filter((edge) => edge.points.length > 0)
    };
}
function route(edge, laid) {
    const section = laid.sections?.[0];
    if (!edge || !section) {
        return;
    }
    edge.points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(({ x, y }) => [x, y]);
    const label = laid.labels?.[0];
    edge.label = {
        x: label?.x ?? 0,
        y: label?.y ?? 0,
        w: label?.width ?? 0,
        h: label?.height ?? 0
    };
}
function only(graph, ran) {
    const edges = graph.edges.filter((edge) => edge.event ? edge.key in ran.edges : edge.target in ran.visits);
    const ends = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
    const nodes = new Map([...graph.nodes].filter(([id, node]) => node.kind === 'start' || node.kind === 'any' ? ends.has(id) : id in ran.visits));
    return { nodes, edges: edges.filter((edge) => nodes.has(edge.source) && nodes.has(edge.target)) };
}
class Graph {
    nodes = new Map();
    edges = [];
    states = new Map();
    constructor(definition) {
        const index = (state) => {
            this.states.set(state.id, state);
            Object.values(state.states ?? {}).forEach(index);
        };
        index(definition);
        if (definition.initial) {
            const id = `${definition.id}::start`;
            this.add({ id, label: '', group: '', kind: 'start', w: 14, h: 14 });
            this.edges.push(blank(id, this.landing(`${definition.id}.${definition.initial}`)));
        }
    }
    walk(state) {
        const children = Object.values(state.states ?? {});
        const group = groupOf(state.id);
        if (children.length === 0) {
            const kind = KINDS[state.type] ?? 'state';
            const label = state.id.split('.').at(-1) ?? state.id;
            const size = kind === 'history' ? { w: 30, h: 30 } : { w: width(label, group), h: 42 };
            this.add({ id: state.id, label, group, kind, ...size });
            this.routes(state, state.id);
            return;
        }
        if (hasRoutes(state)) {
            const id = `${state.id}::any`;
            const name = state.id.split('.').at(-1) ?? state.id;
            const label = state.id.includes('.') ? `any ${name} state` : 'any state';
            this.add({ id, label, group: '', kind: 'any', w: width(label, ''), h: 34 });
            this.routes(state, id);
        }
        children.forEach((child) => this.walk(child));
    }
    add(node) {
        this.nodes.set(node.id, { ...node, x: 0, y: 0, stays: [] });
    }
    routes(state, from) {
        const lists = [
            ...Object.entries(state.on ?? {}),
            ['always', state.always]
        ];
        for (const [event, list] of lists) {
            for (const [index, route] of (list ?? []).entries()) {
                if (!route.target?.length) {
                    this.nodes.get(from)?.stays.push(eventName(event));
                    continue;
                }
                for (const target of route.target) {
                    this.edges.push({
                        ...blank(from, this.landing(target)),
                        key: `${state.id}|${event}|${index}`,
                        event: eventName(event),
                        guard: route.guard ?? null
                    });
                }
            }
        }
    }
    landing(id) {
        const state = this.states.get(id);
        return state?.initial && state.states ? this.landing(`${id}.${state.initial}`) : id;
    }
}
function hasRoutes(state) {
    return Object.keys(state.on ?? {}).length > 0 || (state.always?.length ?? 0) > 0;
}
function groupOf(id) {
    return id.split('.').slice(2, -1).join('.');
}
function width(label, group) {
    return Math.max(label.length, group.length * 0.85) * CHAR + 64;
}
function blank(source, target) {
    return {
        key: `${source}|start|0`,
        source,
        target,
        event: '',
        guard: null,
        points: [],
        label: { x: 0, y: 0, w: 0, h: 0 }
    };
}
function labelSize(edge) {
    const lines = [edge.event, edge.guard ? `[${edge.guard}]` : ''].filter(Boolean);
    return {
        width: Math.max(...lines.map((line) => line.length)) * CHAR * 0.85 + 40,
        height: lines.length * LINE + 6
    };
}
export function eventName(type) {
    if (type === 'always' || type === '')
        return 'always';
    if (type.startsWith('xstate.done.actor.'))
        return 'done';
    if (type.startsWith('xstate.error.actor.')) {
        return 'error';
    }
    return type.startsWith('xstate.after.') ? `after ${type.split('.')[2] ?? ''}`.trim() : type;
}
