import { sanitizeCommand } from './scope.js';
export function isPythonLanguage(language) {
    return typeof language === 'string' && language.trim().toLowerCase() === 'python';
}
const INTERPS = ['python3', 'python', 'py'];
const PIPS = ['pip3', 'pip'];
function isAsciiWs(c) {
    return c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
}
function skipWs(s, i) {
    while (i < s.length && isAsciiWs(s.charAt(i))) {
        i++;
    }
    return i;
}
function leadingToken(s, tokens) {
    for (const t of tokens) {
        if (!s.startsWith(t))
            continue;
        const next = s[t.length];
        if (next !== undefined && /[A-Za-z0-9_]/.test(next)) {
            continue;
        }
        return t;
    }
    return null;
}
function unquote(payload) {
    const quote = payload[0];
    if (quote !== '"' && quote !== "'") {
        return payload;
    }
    const body = payload.endsWith(quote) ? payload.slice(1, -1) : payload.slice(1);
    return quote === '"' ? body.replace(/\\"/g, '"') : body;
}
function unwrapHeredoc(s) {
    const interp = leadingToken(s, INTERPS);
    if (!interp) {
        return null;
    }
    let i = skipWs(s, interp.length);
    if (!s.startsWith('<<', i)) {
        return null;
    }
    i += 2;
    if (s[i] === '-') {
        i++;
    }
    i = skipWs(s, i);
    const open = s.charAt(i);
    const quote = open === '"' || open === "'" ? open : null;
    if (quote) {
        i++;
    }
    const tagStart = i;
    while (i < s.length && /[A-Za-z0-9_]/.test(s.charAt(i))) {
        i++;
    }
    if (i === tagStart) {
        return null;
    }
    const tag = s.slice(tagStart, i);
    if (quote) {
        if (s[i] !== quote) {
            return null;
        }
        i++;
    }
    while (i < s.length && (s[i] === ' ' || s[i] === '\t')) {
        i++;
    }
    if (s[i] !== '\n') {
        return null;
    }
    i++;
    const body = s.slice(i);
    for (let j = 0; j < body.length; j++) {
        if (body[j] !== '\n')
            continue;
        let k = j + 1;
        const closeInterp = leadingToken(body.slice(k), INTERPS);
        if (closeInterp) {
            k += closeInterp.length;
        }
        k = skipWs(body, k);
        if (!body.startsWith(tag, k)) {
            continue;
        }
        k += tag.length;
        k = skipWs(body, k);
        if (k === body.length) {
            return body.slice(0, j).trim();
        }
    }
    return body.trim();
}
function unwrapDashC(s) {
    const interp = leadingToken(s, INTERPS);
    if (!interp) {
        return null;
    }
    let i = skipWs(s, interp.length);
    if (!s.startsWith('-c', i)) {
        return null;
    }
    i += 2;
    if (i >= s.length || !isAsciiWs(s.charAt(i))) {
        return null;
    }
    i = skipWs(s, i);
    if (i >= s.length) {
        return null;
    }
    const source = unquote(s.slice(i).trim()).trim();
    return source || null;
}
function unwrapBareInterpreter(s) {
    const interp = leadingToken(s, INTERPS);
    if (!interp) {
        return null;
    }
    let i = interp.length;
    while (i < s.length && (s[i] === ' ' || s[i] === '\t')) {
        i++;
    }
    if (s[i] !== '\n') {
        return null;
    }
    const body = s.slice(i + 1).trim();
    return body || null;
}
export function unwrapPythonSource(command) {
    const trimmed = withoutProgramDir(command).trim();
    const heredoc = unwrapHeredoc(trimmed);
    if (heredoc !== null) {
        return heredoc;
    }
    const dashC = unwrapDashC(trimmed);
    if (dashC !== null) {
        return dashC;
    }
    return unwrapBareInterpreter(trimmed);
}
export function withoutProgramDir(command) {
    return command.trimStart().replace(/^[^\s'"]*[/\\](?=[^\s/\\]+(\s|$))/, '');
}
function pipInstallRest(command) {
    const s = withoutProgramDir(command).trim();
    let i = 0;
    const pip = leadingToken(s, PIPS);
    if (pip) {
        i = pip.length;
    }
    else {
        const interp = leadingToken(s, INTERPS);
        if (!interp) {
            return null;
        }
        i = skipWs(s, interp.length);
        if (!s.startsWith('-m', i)) {
            return null;
        }
        i += 2;
        if (i >= s.length || !isAsciiWs(s.charAt(i))) {
            return null;
        }
        i = skipWs(s, i);
        if (!s.startsWith('pip', i)) {
            return null;
        }
        const after = s[i + 3];
        if (after !== undefined && /[A-Za-z0-9_]/.test(after)) {
            return null;
        }
        i += 3;
    }
    if (i >= s.length || !isAsciiWs(s.charAt(i))) {
        return null;
    }
    i = skipWs(s, i);
    if (!s.startsWith('install', i)) {
        return null;
    }
    i += 'install'.length;
    if (i >= s.length || !isAsciiWs(s.charAt(i))) {
        return null;
    }
    i = skipWs(s, i);
    if (i >= s.length) {
        return null;
    }
    return s.slice(i);
}
const REQUIREMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*(\[[A-Za-z0-9,._-]+\])?([=<>!~]=?[^\s]+)?$/;
export function pipInstallTargets(command) {
    const rest = pipInstallRest(command);
    if (!rest) {
        return null;
    }
    const targets = [];
    for (const raw of rest.split(/\s+/)) {
        if (/[|;&<>()`$]/.test(raw))
            break;
        const token = raw.replace(/^['"]|['"]$/g, '');
        if (/^(-r|--requirement|-e|--editable|-c|--constraint|-f|--find-links)$/.test(token)) {
            return null;
        }
        if (!token || token.startsWith('-')) {
            continue;
        }
        if (!REQUIREMENT.test(token)) {
            return null;
        }
        if (/^pip3?$/i.test(token.split(/[=<>!~[]/)[0] ?? '')) {
            continue;
        }
        targets.push(token);
    }
    return targets.length > 0 ? targets : null;
}
function firstCodeLine(command) {
    return (command
        .split('\n')
        .find((line) => line.trim() && !line.trim().startsWith('#'))
        ?.trim() ?? '');
}
const PYTHON_START = /^(from\s+[\w.]+\s+import\b|import\s+[\w.]+\s*(,|;|$|\sas\s)|def\s+\w+\s*\(|class\s+\w+|@[\w.]+|(for|while|if|with|try|async)\b[^\n]*:$|"""|\'\'\'|[A-Za-z_][\w.]*(\[[^\]]*\])?\s+=\s+)/;
export function startsLikePython(command) {
    return PYTHON_START.test(firstCodeLine(command));
}
export function isPythonSourceShaped(command) {
    const first = firstCodeLine(command);
    if (/^from\s+[\w.]+\s+import\b/.test(first)) {
        return true;
    }
    if (/^[A-Za-z_][\w.]*\s*\(/.test(first) && !/^[A-Za-z_]\w*\s*\(\s*\)\s*\{/.test(first)) {
        return true;
    }
    if (!PYTHON_START.test(first)) {
        return false;
    }
    return command.trim().includes('\n') || sanitizeCommand(command) !== null;
}
