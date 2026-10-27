const SHELL_OPERATOR = /(&&|\|\||;|\||\n)/;
const RUNNER = /^(python[\d.]*|bash|sh|node|bun|pytest)$/;
const CHECKS_HEADING = /^[\s*#_]*checks:?[\s*_]*$/i;
const CHECK_LINE = /^\s*(?:[-*]|\d+[.)])?\s*`([^`]+)`\s*$/;
export const MAX_GOAL_CHECKS = 8;
export const GOAL_CHECKS_ASK = '[This goal has no checks yet. Name the commands that will prove the task is done: write a ' +
    'line `Checks:`, then one command per line in backticks, such as `test -s /app/result.json` ' +
    'or `python3 check.py`. Each must exit 0 only once the task is done, with no pipe, ; or && ' +
    'in it. The goal is met only once each of them ran on its own and exited 0.]';
export const GOAL_PROOF_ASK = '[The checks this goal has so far may only show that the output exists, not that it is right. Name the ' +
    'commands that will prove the result is correct, such as running the program on an input ' +
    "and comparing with what the task asks, or the task's own tests: write a line `Checks:`, " +
    'then one command per line in backticks, with no pipe, ; or && in it. A command that repeats ' +
    'one of those checks does not count. The goal is met only once each check ran on its own and exited 0.]';
export function namedChecks(text) {
    const lines = text.split('\n');
    const heading = lines.findIndex((line) => CHECKS_HEADING.test(line));
    if (heading < 0) {
        return [];
    }
    const named = [];
    for (const line of lines.slice(heading + 1)) {
        const command = CHECK_LINE.exec(line)?.[1].trim();
        if (!command) {
            if (line.trim() || named.length) {
                break;
            }
            continue;
        }
        if (runsCheck(command, command) && !named.includes(command)) {
            named.push(command);
        }
    }
    return named.slice(0, MAX_GOAL_CHECKS);
}
export function mergeChecks(host, named) {
    const known = new Set(host.map(normalize));
    const fresh = named
        .filter((name) => !known.has(normalize(name)))
        .slice(0, host.length ? MAX_GOAL_CHECKS - 1 : MAX_GOAL_CHECKS);
    if (!fresh.length) {
        return [];
    }
    return [...host.slice(0, MAX_GOAL_CHECKS - fresh.length), ...fresh];
}
function normalize(command) {
    return command.trim().replace(/\s+/g, ' ');
}
export function runsCheck(command, check) {
    const wanted = words(check);
    const parts = command.split(SHELL_OPERATOR);
    for (let at = parts.length - 1; at >= 0; at -= 2) {
        if (!parts[at].trim()) {
            parts.splice(at === parts.length - 1 ? Math.max(at - 1, 0) : at, 2);
        }
    }
    for (let at = 0; at < parts.length; at += 2) {
        const after = parts.slice(at + 1).filter((_, n) => n % 2 === 0);
        if (parts[at - 1] !== '||' &&
            after.every((operator) => operator === '&&') &&
            invokes(words(parts[at]), wanted)) {
            return true;
        }
    }
    return false;
}
function words(text) {
    return text
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.replace(/^['"]|['"]$/g, ''));
}
function invokes(tokens, wanted) {
    let start = tokens.findIndex((token) => !/^\w+=/.test(token));
    if (start < 0) {
        return false;
    }
    if (leads(tokens.slice(start), wanted)) {
        return true;
    }
    if (!RUNNER.test(tokens[start].split('/').at(-1) ?? '')) {
        return false;
    }
    start++;
    while (tokens[start]?.startsWith('-')) {
        start++;
    }
    return leads(tokens.slice(start), wanted);
}
function leads(tokens, wanted) {
    return (wanted.length > 0 &&
        wanted.every((word, at) => tokens[at] !== undefined && samePath(tokens[at], word)));
}
function samePath(a, b) {
    const left = a.replace(/^\.\//, '');
    const right = b.replace(/^\.\//, '');
    return left === right || left.endsWith(`/${right}`) || right.endsWith(`/${left}`);
}
