const TYPOGRAPHIC = {
    '“': '"',
    '”': '"',
    '‘': "'",
    '’': "'",
    '–': '-',
    '—': '-',
    ' ': ' '
};
function plain(text) {
    return text.replace(/[“”‘’–— ]/g, (c) => TYPOGRAPHIC[c] ?? c);
}
function occurrences(haystack, needle) {
    const found = [];
    let at = haystack.indexOf(needle);
    while (at !== -1) {
        found.push({ from: at, to: at + needle.length });
        at = haystack.indexOf(needle, at + needle.length);
    }
    return found;
}
function lineStarts(lines) {
    const starts = [];
    let offset = 0;
    for (const line of lines) {
        starts.push(offset);
        offset += line.length + 1;
    }
    return starts;
}
function trimmedLineSpans(content, old) {
    const lines = content.split('\n');
    const wanted = old.split('\n').map((line) => line.trimEnd());
    const ownsNewline = wanted.length > 1 && wanted[wanted.length - 1] === '';
    if (ownsNewline) {
        wanted.pop();
    }
    const starts = lineStarts(lines);
    const spans = [];
    for (let i = 0; i + wanted.length <= lines.length; i++) {
        const block = lines.slice(i, i + wanted.length);
        if (block.every((line, k) => line.trimEnd() === wanted[k])) {
            const last = i + wanted.length - 1;
            const end = starts[last] + lines[last].length;
            spans.push({ from: starts[i], to: ownsNewline && last < lines.length - 1 ? end + 1 : end });
        }
    }
    return spans;
}
function spansFor(content, old) {
    const exact = occurrences(content, old);
    if (exact.length) {
        return exact;
    }
    const typographic = occurrences(plain(content), plain(old));
    if (typographic.length) {
        return typographic;
    }
    return trimmedLineSpans(plain(content), plain(old));
}
function ambiguity(text, spans) {
    const lines = spans.map((span) => text.slice(0, span.from).split('\n').length).join(', ');
    return `old text matches ${spans.length} places (lines ${lines}). Include a neighbouring line so it matches once, or set replaceAll to change every one.`;
}
const NUMBERED = /^\s*\d+\| ?/;
function unnumbered(text) {
    const lines = text.split('\n');
    const filled = lines.filter((line) => line.trim());
    return filled.length && filled.every((line) => NUMBERED.test(line))
        ? lines.map((line) => line.replace(NUMBERED, '')).join('\n')
        : text;
}
function closest(text, old) {
    const lines = text.split('\n');
    const file = lines.map((line) => pairsOf(line.trim()));
    const wanted = old.split('\n');
    const probe = wanted.slice(0, PROBE_LINES).map((line) => pairsOf(line.trim()));
    let best = { at: -1, score: 0 };
    for (let i = 0; i + wanted.length <= lines.length; i++) {
        const sum = probe.reduce((total, pairs, k) => total + likeness(pairs, file[i + k] ?? NONE), 0);
        if (sum / probe.length > best.score) {
            best = { at: i, score: sum / probe.length };
        }
    }
    if (best.at === -1 || best.score < CLOSE_ENOUGH) {
        return null;
    }
    const from = Math.max(0, best.at - CONTEXT_LINES);
    const to = Math.min(lines.length, best.at + wanted.length + CONTEXT_LINES);
    return lines
        .slice(from, to)
        .map((line, i) => `${from + i + 1}| ${line}`)
        .join('\n');
}
const NONE = { text: '', size: 0, counts: new Map() };
function pairsOf(text) {
    const counts = new Map();
    for (let i = 0; i < text.length - 1; i++) {
        const pair = text.slice(i, i + 2);
        counts.set(pair, (counts.get(pair) ?? 0) + 1);
    }
    return { text, size: Math.max(0, text.length - 1), counts };
}
function likeness(a, b) {
    if (a.text === b.text) {
        return 1;
    }
    if (a.size === 0 || b.size === 0) {
        return 0;
    }
    let shared = 0;
    for (const [pair, count] of a.counts) {
        shared += Math.min(count, b.counts.get(pair) ?? 0);
    }
    return (2 * shared) / (a.size + b.size);
}
const CLOSE_ENOUGH = 0.6;
const CONTEXT_LINES = 2;
const PROBE_LINES = 8;
const DISTINCT_CHARS = 24;
function notFound(text, old, replacement) {
    if (replacement.trim().length >= DISTINCT_CHARS && spansFor(text, replacement).length) {
        return 'old text not found, and the new text is already in the file: this edit looks done. Read the file to check before changing it again.';
    }
    const near = closest(text, old);
    return near
        ? `old text not found. Did you mean these lines? Copy them exactly, indentation included, without the line numbers:\n${near}`
        : 'old text not found. Read the file with read_file and copy the exact lines you want to change, including their indentation.';
}
export function editMatch(content, request) {
    const crlf = content.includes('\r\n');
    const text = crlf ? content.replace(/\r\n/g, '\n') : content;
    const asked = request.old.replace(/\r\n/g, '\n');
    let old = asked;
    let replacement = request.replacement.replace(/\r\n/g, '\n');
    let spans = spansFor(text, old);
    if (!spans.length && unnumbered(asked) !== asked) {
        old = unnumbered(asked);
        replacement = unnumbered(replacement);
        spans = spansFor(text, old);
    }
    if (!spans.length) {
        return { content, count: 0, error: notFound(text, old, replacement) };
    }
    if (spans.length > 1 && !request.replaceAll) {
        return { content, count: 0, error: ambiguity(text, spans) };
    }
    let next = text;
    for (const span of [...spans].sort((a, b) => b.from - a.from)) {
        next = next.slice(0, span.from) + replacement + next.slice(span.to);
    }
    return { content: crlf ? next.replace(/\n/g, '\r\n') : next, count: spans.length, error: null };
}
