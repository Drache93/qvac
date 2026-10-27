const PILL = {
    ok: 'ok',
    failed: 'failed',
    rejected: 'rejected',
    denied: 'denied',
    pending: 'no result',
    running: 'running'
};
const CHAR = 6.6;
export function flowSvg(flow, esc) {
    const pad = 16;
    const w = flow.w + pad * 2;
    const h = flow.h + pad * 2;
    const status = new Map(flow.nodes.map((node) => [node.id, node.status]));
    return `<svg id="chart-flow" class="chart" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${-pad} ${-pad} ${w} ${h}" data-w="${w}" data-h="${h}">
<defs><marker id="arrow-flow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--fg-faint)"/></marker></defs>
${flow.edges.map((edge) => link(edge, status.get(edge.target) ?? '')).join('\n')}
${flow.nodes.map((node) => box(node, esc)).join('\n')}
</svg>`;
}
function link(edge, target) {
    if (edge.points.length === 0) {
        return '';
    }
    const d = `M${edge.points.map(([x, y]) => `${x},${y}`).join(' L')}`;
    return `<path class="fe s-${target}" d="${d}" marker-end="url(#arrow-flow)"/>`;
}
function box(node, esc) {
    const { x, y, w, h } = node;
    const pill = PILL[node.status];
    const pillW = pill ? pill.length * CHAR + 16 : 0;
    const head = pill
        ? `<rect class="pill" x="${x + 12}" y="${y + 11}" width="${pillW}" height="18" rx="5"/><text class="pill-t" x="${x + 12 + pillW / 2}" y="${y + 24}" text-anchor="middle">${esc(pill.toUpperCase())}</text><text class="title mono" x="${x + 20 + pillW}" y="${y + 25}">${esc(node.title)}</text>`
        : `<text class="title" x="${x + 14}" y="${y + 25}">${esc(node.title)}</text>`;
    const lines = node.lines
        .map((line, index) => `<text class="line" x="${x + 14}" y="${y + 47 + index * 17}">${esc(line)}</text>`)
        .join('');
    const badge = node.badge
        ? `<text class="badge" x="${x + 14}" y="${y + h - 12}">${esc(node.badge)}</text>`
        : '';
    return `<g class="fn k-${node.kind} s-${node.status}" data-node="${esc(node.id)}"><rect class="body" x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/>${head}<text class="meta" x="${x + w - 12}" y="${y + 25}" text-anchor="end">${esc(node.meta)}</text>${lines}${badge}</g>`;
}
export function storyChips(story, esc) {
    const calls = story.rounds.flatMap((round) => round.calls);
    const bad = ['failed', 'rejected', 'denied', 'pending'];
    const counts = bad.flatMap((outcome) => {
        const count = calls.filter((call) => call.outcome === outcome).length;
        return count
            ? [`<span class="chip o-${outcome}">${count} ${esc(PILL[outcome] ?? outcome)}</span>`]
            : [];
    });
    const asked = calls.filter((call) => call.approved !== null).length;
    return [...counts, asked ? `<span class="chip info">${asked} asked a person</span>` : ''].join('');
}
