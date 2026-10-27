import { WORDMARK } from './brand.js';
import { MEANINGS } from './meaning.js';
import { SCRIPT } from './script.js';
import { flowSvg, storyChips } from './flow-view.js';
import { STYLE } from './style.js';
export const FONTS = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Inconsolata:wght@400;600;700&display=swap';
export function parts(model, views, title) {
    return {
        title,
        hero: hero(model, title),
        jumps: jumps(model),
        canvas: canvas(model, views),
        machine: views.machine !== null,
        data: pageData(model, views)
    };
}
export function page(model, views, title) {
    return shell(parts(model, views, title));
}
export function shell(report, { live } = {}) {
    const title = report?.title ?? 'Waiting for the run';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · QVAC</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet"><style>${STYLE}</style></head><body${live ? ' data-live="1"' : ''}${report ? '' : ' class="waiting-for-run"'}><main>
<header class="topbar"><div class="brand">${WORDMARK}<span>Run report</span></div><div class="topbar-end">${live ? '<span class="live-pill" id="live-pill"><i></i><span id="live-text">Connecting</span></span>' : ''}<button class="pill" type="button" id="theme">Theme</button></div></header>
${live ? '<nav class="run-tabs" id="run-tabs" aria-label="Runs"></nav><div class="new-run" id="new-run" hidden></div>' : ''}
${live ? waitingCard(live.source) : ''}
<div id="hero-slot">${report?.hero ?? ''}</div>
<section id="flow"><h2>How the run went</h2>
<p class="section-lede">From the request to the answer: each round the model took, and each call it made, colored by how it went, with the reason when it went wrong. Click any box for its details and the state machine steps inside it. Press play or use ← and → to walk the run.</p>
${board(report)}</section>
</main>
<script type="application/json" id="data">${report ? json(report.data) : 'null'}</script>
<script>${SCRIPT}</script></body></html>`;
}
function pageData(model, views) {
    const chart = views.machine?.all;
    return {
        meanings: MEANINGS,
        flow: views.flow.nodes.map(({ x, y, w, h, ...box }) => box),
        run: model.run,
        steps: model.steps,
        visits: model.visits,
        edges: model.edges,
        story: model.story,
        hops: model.hops,
        nodes: chart?.nodes.map(({ id, label, group, kind, stays }) => ({
            id,
            label,
            group,
            kind,
            stays
        })) ?? [],
        routes: chart?.edges.map(({ key, source, target, event, guard }) => ({
            key,
            source,
            target,
            event,
            guard
        })) ?? []
    };
}
function canvas(model, { flow, machine }) {
    return (flowSvg(flow, esc) +
        (machine ? svg(machine.run, model, 'run') + svg(machine.all, model, 'all') : ''));
}
function board(report) {
    const machine = report?.machine ?? true;
    return `<div class="board"><div class="card flow">
<div class="toolbar"><div class="views"><button class="pill" type="button" data-chart="flow" aria-pressed="true">The run</button>${machine ? '<button class="pill" type="button" data-chart="machine" aria-pressed="false">State machine</button>' : ''}</div>
<div class="legend flow-only"><span class="o-ok"><i></i>ok</span><span class="o-failed"><i></i>failed</span><span class="o-rejected"><i></i>rejected</span><span class="o-denied"><i></i>denied</span></div>
<div class="legend machine-only"><span class="l-now"><i></i>this step</span><span class="l-taken"><i></i>taken</span><span class="l-not"><i></i>never taken</span><span class="l-trouble"><i></i>call turned down</span><span class="l-person"><i></i>a person decides</span><span class="l-error"><i></i>failed</span></div><span class="grow"></span>
<button class="pill machine-only" type="button" id="untaken" aria-pressed="false">Whole machine</button>
<button class="pill" type="button" id="facts" aria-pressed="false">Fact refreshes</button>
<button class="pill" type="button" id="follow" aria-pressed="true">Follow</button>
<button class="pill" type="button" id="zoom-out" aria-label="Zoom out">−</button><button class="pill" type="button" id="zoom-in" aria-label="Zoom in">+</button><button class="pill" type="button" id="fit">Fit</button></div>
<div id="jumps-slot">${report?.jumps ?? ''}</div><div class="canvas-wrap"><div class="canvas" id="canvas">${report?.canvas ?? ''}</div><button type="button" class="to-live" id="to-live" hidden>Jump to live</button></div>
<div class="player"><div class="buttons"><button type="button" id="first" aria-label="First step">⏮</button><button type="button" id="prev" aria-label="Previous step">◀</button><button type="button" class="play" id="play" aria-label="Play">▶</button><button type="button" id="next" aria-label="Next step">▶︎▶︎</button></div>
<input type="range" id="scrub" min="0" max="0" value="0" aria-label="Step"><span class="where" id="where"></span><div class="ticks" id="ticks"></div></div>
</div><aside class="card panel" id="panel"></aside></div>`;
}
function jumps(model) {
    const bad = model.story.rounds
        .flatMap((round) => round.calls)
        .filter((call) => call.outcome !== 'ok' && call.outcome !== 'running' && call.step !== null);
    if (bad.length === 0) {
        return '';
    }
    const chips = bad.map((call) => `<button type="button" class="chip o-${call.outcome}" data-goto="${call.step}">Round ${call.round + 1} · ${esc(call.name)} · ${esc(call.outcome === 'pending' ? 'no result' : call.outcome)}</button>`);
    return `<div class="jumps"><span class="muted">Went wrong:</span>${chips.join('')}</div>`;
}
function hero(model, title) {
    const { run } = model;
    const wall = run.startedAt && run.endedAt ? duration(run.endedAt - run.startedAt) : '?';
    const approvals = model.visits['completion.active.tools.approving']?.length ?? 0;
    const tiles = [
        ['rounds', String(run.rounds)],
        ['tool calls', String(model.story.rounds.flatMap((round) => round.calls).length)],
        ['approvals', String(approvals)],
        ['tokens', run.tokens === null ? '?' : String(run.tokens)],
        ['wall time', wall],
        ['state changes', String(model.steps.filter((step) => step.kind === 'transition').length)]
    ];
    const limits = [
        run.maxToolRounds === null ? '' : `at most ${run.maxToolRounds} tool rounds`,
        run.deadline && run.startedAt ? `deadline ${duration(run.deadline - run.startedAt)}` : ''
    ].filter(Boolean);
    return `<div class="card hero"><p class="eyebrow">Run ${esc(run.runId.slice(0, 12))}</p>
<h1>${esc(title)}</h1>
<p class="lede">${agents(model)}, completion machine v${esc(String(run.machine ?? '?'))}.</p>
<div class="chips">${statusChip(model)}${storyChips(model.story, esc)}${limits.map((limit) => `<span class="chip warn">${esc(limit)}</span>`).join('')}</div>
${run.tools.length ? `<p class="offered">Tools offered: ${run.tools.map((tool) => `<code>${esc(tool)}</code>`).join(' ')}</p>` : ''}
<div class="tiles">${tiles.map(([key, val]) => `<div class="tile"><b>${esc(val)}</b><span>${esc(key)}</span></div>`).join('')}</div>
${run.response ? `<details class="answer"><summary>The answer</summary><pre class="json">${esc(run.response)}</pre></details>` : ''}
${run.replay ? `<div class="notice">${esc(run.replay)}</div>` : ''}</div>`;
}
function statusChip({ run, running }) {
    if (running) {
        return '<span class="chip running">running</span>';
    }
    const good = run.outcome === 'success' || run.status === 'done';
    return `<span class="chip ${good ? 'good' : 'warn'}">${esc(run.outcome)}</span>`;
}
function agents({ run, hops }) {
    const runs = hops.length ? hops : [run];
    const named = runs.map((hop) => `<b>${esc(hop.agent)}</b> on <code>${esc(hop.model)}</code>`);
    return `${runs.length > 1 ? 'Agents' : 'Agent'} ${named.join(' → ')}`;
}
function svg(chart, model, which) {
    const pad = 16;
    const w = chart.w + pad * 2;
    const h = chart.h + pad * 2;
    return `<svg id="chart-${which}" class="chart" style="display:none" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${-pad} ${-pad} ${w} ${h}" data-w="${w}" data-h="${h}">
<defs>${MARKS.map((kind) => marker(kind, which)).join('')}</defs>
${chart.edges.map((edge) => route(edge, model)).join('\n')}
${chart.nodes.map((node) => state(node, model)).join('\n')}
${chart.nodes.map((node) => badge(node, troubles(model))).join('')}
</svg>`;
}
const FILLS = {
    faint: 'var(--fg-faint)',
    taken: 'var(--primary)',
    hot: 'var(--fg)',
    picked: 'var(--info-fg)',
    trouble: 'var(--warn-fg)',
    person: 'var(--info-fg)',
    limit: 'var(--warn-fg)',
    error: 'var(--bad-fg)'
};
const MARKS = Object.keys(FILLS);
function marker(kind, which) {
    const fill = FILLS[kind];
    return `<marker id="arrow-${which}-${kind}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:${fill}"/></marker>`;
}
function state(node, model) {
    const seen = node.kind === 'any' || node.kind === 'start' || node.id in model.visits;
    const meaning = MEANINGS[node.id];
    const tone = meaning?.tone ? ` t-${meaning.tone}` : '';
    const cls = `n ${node.kind} ${seen ? 'visited' : 'unvisited'}${tone}`;
    const id = esc(node.id);
    const tip = meaning ? `<title>${esc(meaning.says)}</title>` : '';
    const cx = node.x + node.w / 2;
    const cy = node.y + node.h / 2;
    if (node.kind === 'start') {
        return `<g class="${cls}" data-id="${id}"><circle cx="${cx}" cy="${cy}" r="7"/></g>`;
    }
    if (node.kind === 'history') {
        return `<g class="${cls}" data-id="${id}">${tip}<circle cx="${cx}" cy="${cy}" r="${node.w / 2}"/><text x="${cx}" y="${cy + 4.5}" text-anchor="middle">H</text></g>`;
    }
    const count = model.visits[node.id]?.length;
    const name = node.group
        ? `<text class="grp" x="${node.x + 12}" y="${node.y + 15}">${esc(node.group)}</text><text x="${node.x + 12}" y="${node.y + 32}">${esc(node.label)}</text>`
        : `<text x="${node.x + 12}" y="${cy + 4.5}">${esc(node.label)}</text>`;
    return `<g class="${cls}" data-id="${id}">${tip}<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="10"/>
${name}${count ? `<text class="count" x="${node.x + node.w - 10}" y="${cy + 4}" text-anchor="end">×${count}</text>` : ''}</g>`;
}
function route(edge, model) {
    const taken = model.edges[edge.key]?.length ?? 0;
    const start = edge.event === '';
    const d = `M${edge.points.map(([x, y]) => `${x},${y}`).join(' L')}`;
    const width = taken ? Math.min(1.6 + Math.log2(taken + 1) * 0.8, 4) : 1.2;
    const tone = MEANINGS[edge.target]?.tone;
    const toned = tone && tone !== 'end' ? tone : '';
    const cls = `e${taken || start ? ' taken' : ''}${toned ? ` to-${toned}` : ''}`;
    const used = taken > 0 || start;
    const head = used ? toned || 'taken' : 'faint';
    const { x, y, w, h } = edge.label;
    const lines = [edge.event, edge.guard ? `[${edge.guard}]` : ''].filter(Boolean);
    const label = start
        ? ''
        : `<g class="lab"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5"/>${lines
            .map((line, index) => `<text x="${x + 6}" y="${y + 14 + index * 15}">${esc(line)}${index === 0 && taken ? `<tspan class="n-taken" dx="6">×${taken}</tspan>` : ''}</text>`)
            .join('')}</g>`;
    return `<g class="${cls}" data-key="${esc(edge.key)}"><path class="hit" d="${d}"/><path class="line" d="${d}" style="stroke-width:${width}" data-head="${head}"/>${label}</g>`;
}
const BADGES = [
    {
        state: 'completion.active.tools.rejecting',
        text: 'rejected',
        tone: 'rejected',
        counts: (call) => call.outcome === 'rejected'
    },
    {
        state: 'completion.active.tools.executing',
        text: 'failed',
        tone: 'failed',
        counts: (call) => call.outcome === 'failed'
    },
    {
        state: 'completion.active.tools.approving',
        text: 'approved',
        tone: 'ok',
        counts: (call) => call.approved === true
    },
    {
        state: 'completion.active.tools.approving',
        text: 'declined',
        tone: 'denied',
        counts: (call) => call.approved === false
    }
];
function troubles(model) {
    const calls = model.story.rounds.flatMap((round) => round.calls);
    const out = new Map();
    for (const rule of BADGES) {
        const n = calls.filter(rule.counts).length;
        if (n > 0) {
            out.set(rule.state, [
                ...(out.get(rule.state) ?? []),
                { text: `${n} ${rule.text}`, tone: rule.tone }
            ]);
        }
    }
    return out;
}
function badge(node, all) {
    let right = node.x + node.w + 6;
    return (all.get(node.id) ?? [])
        .map((trouble) => {
        const w = trouble.text.length * 6.4 + 14;
        right -= w + 4;
        return `<g class="tb o-${trouble.tone}" data-id="${esc(node.id)}"><rect x="${right}" y="${node.y - 11}" width="${w}" height="18" rx="9"/><text x="${right + w / 2}" y="${node.y + 2}" text-anchor="middle">${esc(trouble.text)}</text></g>`;
    })
        .join('');
}
function json(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}
function waitingCard(source) {
    return `<div class="waiting" id="waiting"><section class="waiting-card" aria-live="polite">
<div class="waiting-mark">${WORDMARK}</div>
<h1 class="waiting-title">Waiting for the run</h1>
<div class="waiting-pulse" aria-hidden="true"><span></span><span></span><span></span></div>
<p class="waiting-lede">This page fills in by itself as soon as the run takes its first step.</p>
${source ? `<div class="waiting-source" title="${esc(source)}">${esc(source)}</div>` : ''}
</section></div>`;
}
export function esc(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function duration(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) {
        return `${s} s`;
    }
    return s < 3600
        ? `${Math.floor(s / 60)}m ${s % 60}s`
        : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
