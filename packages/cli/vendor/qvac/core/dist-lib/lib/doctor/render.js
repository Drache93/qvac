const GLYPH = {
    pass: '✓',
    warn: '⚠',
    fail: '✗',
    declared: '·',
    pending: '⋯'
};
const TEE = '├─';
const ELBOW = '└─';
const PIPE = '│ ';
const GAP = '  ';
const plain = (text) => text;
export function summarize(checks) {
    const counts = { pass: 0, warn: 0, fail: 0, declared: 0, pending: 0 };
    for (const item of checks) {
        counts[item.state] += 1;
    }
    const parts = [`${counts.pass} ok`];
    if (counts.warn) {
        parts.push(`${counts.warn} warning${counts.warn === 1 ? '' : 's'}`);
    }
    if (counts.fail) {
        parts.push(`${counts.fail} failed`);
    }
    if (counts.declared) {
        parts.push(`${counts.declared} unverified`);
    }
    if (counts.pending) {
        parts.push(`${counts.pending} measuring`);
    }
    return parts.join(' · ');
}
function groupsOf(checks) {
    const groups = new Map();
    for (const item of checks) {
        const existing = groups.get(item.group);
        if (existing) {
            existing.push(item);
        }
        else {
            groups.set(item.group, [item]);
        }
    }
    return groups;
}
export function checkLines(checks, { paint = plain } = {}) {
    const out = [];
    for (const [group, items] of groupsOf(checks)) {
        out.push('', paint(group.toUpperCase(), 'title'));
        const width = Math.max(...items.map((item) => item.name.length));
        items.forEach((item, index) => {
            const last = index === items.length - 1;
            const glyph = paint(GLYPH[item.state], item.state);
            out.push(`${last ? ELBOW : TEE} ${glyph} ${item.name.padEnd(width)}  ${item.detail}`);
            if (item.state === 'declared' && item.fix) {
                out.push(`${last ? GAP : PIPE}      ${paint(item.fix, 'explain')}`);
            }
        });
    }
    return [...out, ...problemLines(checks, paint), ...legendLines(checks, paint)];
}
function problemLines(checks, paint) {
    const problems = checks.filter((item) => item.state === 'fail' || item.state === 'warn');
    if (problems.length === 0) {
        return [];
    }
    const out = ['', paint('WHAT TO DO', 'title')];
    problems.forEach((item, index) => {
        const connector = index === problems.length - 1 ? ELBOW : TEE;
        const glyph = paint(GLYPH[item.state], item.state);
        out.push(`${connector} ${glyph} ${item.name} — ${item.fix ?? item.detail}`);
    });
    return out;
}
function legendLines(checks, paint) {
    if (!checks.some((item) => item.state === 'declared'))
        return [];
    return [
        '',
        paint(`${GLYPH.declared} unverified — reported by config or not measured in this run, so it is not`, 'explain'),
        paint('  proof the thing works. Never read one as a pass.', 'explain')
    ];
}
