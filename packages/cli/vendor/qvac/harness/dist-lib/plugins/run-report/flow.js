const PER_LINE = 34;
const PER_CALL_LINE = 42;
const ROUND_W = 250;
const CALL_W = 300;
const GAP_X = 44;
const GAP_Y = 30;
export function flow(model) {
    const nodes = graph(model);
    own(nodes, model);
    const rows = rowsOf(nodes);
    const edges = [];
    let y = 0;
    let w = 0;
    for (const row of rows) {
        const [lead, ...calls] = row;
        const h = Math.max(...row.map((node) => node.h));
        Object.assign(lead ?? {}, { x: 0, y, w: ROUND_W });
        calls.forEach((call, index) => Object.assign(call, { x: ROUND_W + GAP_X + index * (CALL_W + 24), y }));
        for (const [index, node] of row.slice(1).entries()) {
            const from = row[index];
            if (from) {
                edges.push(across(from, node));
            }
        }
        w = Math.max(w, ...row.map((node) => node.x + node.w));
        y += h + GAP_Y;
    }
    for (const [index, row] of rows.slice(1).entries()) {
        const above = rows[index]?.[0];
        const lead = row[0];
        if (above && lead) {
            edges.push(down(above, lead));
        }
    }
    return { w, h: y - GAP_Y, nodes, edges };
}
function rowsOf(nodes) {
    const rows = [];
    for (const node of nodes) {
        if (node.kind === 'call') {
            rows.at(-1)?.push(node);
        }
        else {
            rows.push([node]);
        }
    }
    return rows;
}
function across(from, to) {
    const y = from.y + 21;
    return {
        source: from.id,
        target: to.id,
        points: [
            [from.x + from.w, y],
            [to.x, y]
        ]
    };
}
function down(from, to) {
    const x = ROUND_W / 2;
    return {
        source: from.id,
        target: to.id,
        points: [
            [x, from.y + from.h],
            [x, to.y]
        ]
    };
}
function graph(model) {
    const { run, story, hops } = model;
    const nodes = [
        node({
            id: 'start',
            kind: 'start',
            status: 'start',
            title: 'Request',
            meta: hops[0]?.agent ?? '',
            lines: wrap(story.prompt)
        })
    ];
    const inputs = inputSteps(model.steps);
    for (const round of story.rounds) {
        const hop = hops.findIndex((hop, index) => index > 0 && hop.round === round.round);
        if (hop > 0) {
            nodes.push(handoffNode(hops, hop));
        }
        nodes.push(...takeInputs(inputs, round.round));
        nodes.push(roundNode(round), ...round.calls.map((call, index) => callNode(call, index)));
    }
    nodes.push(...takeInputs(inputs, Infinity));
    if (model.running) {
        nodes.push(node({ id: 'end', kind: 'end', status: 'running', title: 'Running', lines: [] }));
        return nodes;
    }
    const good = run.outcome === 'success' || run.status === 'done';
    nodes.push(node({
        id: 'end',
        kind: 'end',
        status: good ? 'done' : 'error',
        title: good ? 'Answer' : `Ended: ${run.outcome}`,
        lines: wrap(good ? run.response : run.failure || run.response)
    }));
    return nodes;
}
function inputSteps(steps) {
    return steps.flatMap((step) => step.kind === 'transition'
        ? step.events
            .filter((event) => event.type === 'INPUT')
            .map((event) => ({
            step: step.index,
            round: step.round,
            mode: String(event.mode),
            text: String(event.text)
        }))
        : []);
}
function takeInputs(inputs, round) {
    const taken = inputs.filter((input) => input.round < round);
    inputs.splice(0, taken.length);
    return taken.map((input) => node({
        id: `input-${input.step}`,
        kind: 'steer',
        status: 'start',
        title: input.mode === 'follow-up' ? 'Follow-up' : 'Steer',
        lines: wrap(input.text),
        from: input.step
    }));
}
function handoffNode(hops, index) {
    const { agent, model, reason, step } = hops[index];
    return node({
        id: `hop-${index}`,
        kind: 'handoff',
        status: 'model',
        title: `${hops[index - 1].agent} → ${agent}`,
        lines: [...wrap(`on ${model}`, 1), ...wrap(reason)],
        from: step
    });
}
function roundNode(round) {
    const meta = [seconds(round.durationMs), round.tokens === null ? '' : `${round.tokens} tokens`];
    return node({
        id: `round-${round.round}`,
        kind: 'round',
        status: 'model',
        title: `Round ${round.round + 1}`,
        meta: meta.filter(Boolean).join(' · '),
        lines: wrap(round.text),
        round: round.round,
        from: round.step
    });
}
function callNode(call, index) {
    const asked = call.approved === null ? '' : `${call.approved ? 'approved' : 'declined'} by a person`;
    const said = call.outcome === 'ok' ? gist(call.args) : call.detail;
    const lines = call.outcome === 'denied' && asked ? [] : wrap(said, 2, PER_CALL_LINE);
    return node({
        id: `call-${call.round}-${index}`,
        kind: 'call',
        status: call.outcome,
        title: call.name,
        meta: seconds(call.durationMs),
        lines,
        badge: asked,
        round: call.round,
        call: index,
        from: call.step
    });
}
function node(input) {
    const lines = input.lines ?? [];
    const badge = input.badge ?? '';
    return {
        meta: '',
        badge,
        round: null,
        call: null,
        from: null,
        ...input,
        lines,
        steps: [],
        x: 0,
        y: 0,
        w: input.kind === 'call' ? CALL_W : ROUND_W,
        h: 40 + lines.length * 17 + (badge ? 22 : 0)
    };
}
function own(nodes, { steps, hops }) {
    const inputs = new Map(nodes.filter((node) => node.kind === 'steer').map((node) => [node.from, node]));
    const started = nodes.filter((node) => node.from !== null && node.kind !== 'steer');
    const end = nodes.at(-1);
    const lastRun = hops.at(-1)?.step ?? 0;
    let finishing = false;
    for (const step of steps) {
        finishing ||=
            step.index >= lastRun &&
                step.kind === 'transition' &&
                step.entered.some((id) => /\.(answering|wrapping|finishing)$/.test(id));
        const owner = inputs.get(step.index) ??
            (finishing
                ? end
                : (started.filter((node) => Number(node.from) <= step.index).at(-1) ?? nodes[0]));
        owner?.steps.push(step.index);
    }
}
function wrap(text, max = 2, per = PER_LINE) {
    const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
        if (line && line.length + word.length + 1 > per) {
            lines.push(line);
            line = '';
        }
        line = line ? `${line} ${word}` : word.slice(0, per);
        if (lines.length === max) {
            break;
        }
    }
    if (line && lines.length < max) {
        lines.push(line);
    }
    if (lines.length === max && words.join(' ').length > lines.join(' ').length) {
        lines[max - 1] = `${(lines[max - 1] ?? '').slice(0, per - 1)}…`;
    }
    return lines;
}
const NAMED = ['intent', 'summary', 'query', 'q', 'path', 'url', 'to', 'text', 'name'];
function gist(args) {
    const texts = [];
    const walk = (value, key, depth) => {
        if (typeof value === 'string') {
            texts.push([key, value]);
        }
        else if (value && typeof value === 'object' && depth < 4) {
            for (const [child, item] of Object.entries(value)) {
                walk(item, Array.isArray(value) ? key : child, depth + 1);
            }
        }
    };
    walk(args, '', 0);
    const named = NAMED.flatMap((name) => texts.filter(([key]) => key === name))[0];
    const longest = [...texts].sort((a, b) => b[1].length - a[1].length)[0];
    return (named ?? longest)?.[1] ?? '';
}
function seconds(ms) {
    if (ms === null) {
        return '';
    }
    return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}
