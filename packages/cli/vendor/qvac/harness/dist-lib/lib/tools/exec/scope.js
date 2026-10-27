import { ShellLine } from './shell-line.js';
export function bareBin(token) {
    if (!token || /[/\\~$]/.test(token))
        return null;
    return token.replace(/\.exe$/i, '').toLowerCase();
}
const EXPANDS = /[A-Za-z_{(?#@*!$-]/;
export function escapeLiteralDollars(command) {
    const chars = [...command];
    let out = '';
    let quoted = false;
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i] ?? '';
        if (c === "'" && !quoted) {
            const end = chars.indexOf("'", i + 1);
            const stop = end === -1 ? chars.length : end + 1;
            out += chars.slice(i, stop).join('');
            i = stop - 1;
            continue;
        }
        if (c === '\\') {
            out += c + (chars[i + 1] ?? '');
            i++;
            continue;
        }
        if (c === '"') {
            quoted = !quoted;
        }
        if (c === '$' && !EXPANDS.test(chars[i + 1] ?? '')) {
            out += '\\';
        }
        out += c;
    }
    return out;
}
export const SHELL_EXPANSION_ERROR = 'command must not use shell expansion: $ outside single quotes is expanded by the shell. ' +
    "Put text containing $ (prices, amounts) in single quotes, e.g. content='Total: $1,348'";
const REFUSED = {
    chain: 'command must not chain with ;',
    ampersand: 'command must not use & or &&',
    pipe: 'command must not use pipes',
    'redirect-output': 'command must not redirect output',
    'redirect-input': 'command must not redirect input',
    newline: 'command must not span multiple lines',
    expansion: SHELL_EXPANSION_ERROR,
    backtick: 'command must not use backtick substitution',
    continuation: 'command must not use line continuations',
    'process-substitution': 'command must not use process substitution',
    subshell: 'command must not use ( ) subshells: run the program directly',
    group: 'command must not use { } groups: run the program directly',
    negation: 'command must not negate with !: run the program directly',
    keyword: 'command must not use shell keywords (if, for, while, case): run one program per call',
    function: 'command must not define shell functions: run the program directly',
    eval: 'command must not run eval, ., source, trap or a builtin given $ or `: run the program directly',
    comment: 'command must not carry a # comment: drop it, or quote a literal #',
    unterminated: 'command must close every quote it opens'
};
export function sanitizeCommand(command) {
    const first = ShellLine.parse(command).constructs[0];
    return first ? REFUSED[first.kind] : null;
}
