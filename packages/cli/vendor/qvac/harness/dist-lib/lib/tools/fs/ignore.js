function escapeRegex(c) {
    return /[.+^${}()|[\]\\*?/-]/.test(c) ? `\\${c}` : c;
}
function classAt(glob, start) {
    const negate = glob[start + 1] === '!' || glob[start + 1] === '^';
    const first = negate ? start + 2 : start + 1;
    let body = '';
    for (let i = first; i < glob.length; i++) {
        const c = glob.charAt(i);
        if (c === ']' && i > first) {
            return { source: negate ? `[^/${body}]` : `[${body}]`, end: i };
        }
        const escaped = c === '\\' && i + 1 < glob.length;
        const literal = escaped ? glob.charAt(++i) : c;
        body += literal === '-' && !escaped ? '-' : escapeRegex(literal);
    }
    return null;
}
function starsAt(glob, i) {
    if (glob[i + 1] !== '*') {
        return { source: '[^/]*', end: i };
    }
    const wholeSegment = (i === 0 || glob[i - 1] === '/') && (i + 2 === glob.length || glob[i + 2] === '/');
    if (!wholeSegment) {
        let end = i + 1;
        while (glob[end + 1] === '*') {
            end++;
        }
        return { source: '[^/]*', end };
    }
    return i + 2 === glob.length
        ? { source: '.*', end: i + 1 }
        : { source: '(?:[^/]*/)*', end: i + 2 };
}
function pieceAt(glob, i) {
    const c = glob.charAt(i);
    if (c === '\\' && i + 1 < glob.length) {
        return { source: escapeRegex(glob.charAt(i + 1)), end: i + 1 };
    }
    if (c === '*') {
        return starsAt(glob, i);
    }
    if (c === '?') {
        return { source: '[^/]', end: i };
    }
    return (c === '[' && classAt(glob, i)) || { source: escapeRegex(c), end: i };
}
function globSource(glob) {
    let source = '';
    for (let i = 0; i < glob.length; i++) {
        const piece = pieceAt(glob, i);
        source += piece.source;
        i = piece.end;
    }
    return source;
}
function parseLine(base, raw) {
    const trimmed = raw.replace(/(?<!\\) +$/, '');
    if (trimmed === '' || trimmed.startsWith('#')) {
        return null;
    }
    const negate = trimmed.startsWith('!');
    const body = negate ? trimmed.slice(1) : trimmed;
    const dirOnly = body.endsWith('/');
    const pattern = dirOnly ? body.slice(0, -1) : body;
    if (pattern === '') {
        return null;
    }
    const anchored = pattern.includes('/');
    const source = globSource(pattern.startsWith('/') ? pattern.slice(1) : pattern);
    try {
        const regex = new RegExp(anchored ? `^${source}$` : `^(?:.*/)?${source}$`);
        return { base, regex, negate, dirOnly };
    }
    catch {
        return null;
    }
}
function matches(rule, relPath, isDir) {
    if (rule.dirOnly && !isDir) {
        return false;
    }
    if (rule.base === '') {
        return rule.regex.test(relPath);
    }
    return relPath.startsWith(`${rule.base}/`) && rule.regex.test(relPath.slice(rule.base.length + 1));
}
export class IgnoreRules {
    #rules;
    constructor(rules = []) {
        this.#rules = rules;
    }
    add(base, text) {
        const added = text
            .split(/\r?\n/)
            .map((line) => parseLine(base, line))
            .filter((rule) => rule !== null);
        return added.length === 0 ? this : new IgnoreRules([...this.#rules, ...added]);
    }
    ignored(relPath, isDir) {
        const rule = this.#rules.findLast((candidate) => matches(candidate, relPath, isDir));
        return rule !== undefined && !rule.negate;
    }
}
