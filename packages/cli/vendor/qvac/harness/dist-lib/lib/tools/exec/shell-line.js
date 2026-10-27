const UNJUDGEABLE = {
    expansion: '$ expansion',
    backtick: 'backtick substitution',
    'process-substitution': 'process substitution',
    subshell: 'subshell',
    group: '{ } group',
    negation: '! negation',
    keyword: 'shell keyword',
    function: 'function definition',
    eval: 'eval, ., source, trap or a builtin given $ or `',
    comment: 'comment',
    unterminated: 'unterminated quote'
};
const KEYWORDS = [
    'if',
    'then',
    'else',
    'elif',
    'fi',
    'for',
    'while',
    'until',
    'do',
    'done',
    'case',
    'esac',
    'in',
    'select',
    'function',
    '[['
];
const RESERVED = new Map([
    ['{', 'group'],
    ['}', 'group'],
    ['!', 'negation'],
    ...KEYWORDS.map((word) => [word, 'keyword'])
]);
const REINTERPRETS = new Set(['eval', '.', 'source', 'trap']);
const SUBSCRIPTS = new Set([
    'let',
    'declare',
    'typeset',
    'local',
    'export',
    'readonly',
    'read',
    'unset'
]);
const SEPARATORS = [
    ['&&', 'ampersand'],
    ['||', 'pipe'],
    ['|&', 'pipe'],
    [';', 'chain'],
    ['&', 'ampersand'],
    ['|', 'pipe']
];
const REDIRECTS = [
    ['&>>', 'ampersand'],
    ['&>', 'ampersand'],
    ['<<<', 'redirect-input'],
    ['<<-', 'redirect-input'],
    ['<<', 'redirect-input'],
    ['<>', 'redirect-input'],
    ['<&', 'redirect-input'],
    ['>>', 'redirect-output'],
    ['>|', 'redirect-output'],
    ['>&', 'redirect-output'],
    ['<', 'redirect-input'],
    ['>', 'redirect-output']
];
const ASSIGNMENT = /^[A-Za-z_]\w*(\[[^\]]*\])?\+?=/;
const BLANK = /^[ \t\n]*$/;
const FD = /^\d+$/;
const GLOB = /[*?]|\[[^\]]*\]/;
const BRACE_LIST = /\{[^{}]*(,|\.\.)[^{}]*\}/;
const QUOTED = '\0';
function emptyCommand() {
    return { argv: [], expands: [], assignments: [], redirects: [] };
}
function expands(unquoted) {
    return GLOB.test(unquoted) || unquoted.startsWith('~') || BRACE_LIST.test(unquoted);
}
function evaluates(argv) {
    const [program = '', ...rest] = argv;
    const named = SUBSCRIPTS.has(program) || (program === 'printf' && rest.includes('-v'));
    return named && rest.some((word) => /[$`]/.test(word));
}
export class ShellLine {
    commands = [];
    ops = [];
    constructs = [];
    unjudgeable;
    #line;
    #i = 0;
    #start = 0;
    #word = null;
    #command = emptyCommand();
    #redirect = null;
    #reason = null;
    constructor(line) {
        this.#line = line;
        while (this.#i < line.length) {
            this.#step();
        }
        this.#endWord();
        this.#endCommand();
        this.constructs.sort((a, b) => a.at - b.at);
        this.unjudgeable = this.#reason;
    }
    static parse(line) {
        return new ShellLine(line);
    }
    static escape(value) {
        return value.replace(/[ \t\\'"`$;&|<>(){}#!*?[\]~]/g, '\\$&').replaceAll('\n', "'\n'");
    }
    #step() {
        const c = this.#line.charAt(this.#i);
        if (this.#word === null) {
            this.#start = this.#i;
        }
        if (c === ' ' || c === '\t') {
            this.#endWord();
            this.#i++;
        }
        else if (c === '\n') {
            this.#newline();
        }
        else if (c === '#' && this.#word === null) {
            this.#comment();
        }
        else if (c === '\\') {
            this.#escaped();
        }
        else if (c === "'") {
            this.#singleQuoted();
        }
        else if (c === '"') {
            this.#doubleQuoted();
        }
        else if (c === '$' || c === '`') {
            this.#mark(c === '$' ? 'expansion' : 'backtick', this.#i);
            this.#bare(c);
        }
        else if (!this.#operator(c)) {
            this.#bare(c);
        }
    }
    #operator(c) {
        const rest = this.#line.slice(this.#i);
        if (/^[<>]\(/.test(rest)) {
            this.#endWord();
            this.#mark('process-substitution', this.#i);
            this.#i += 2;
            return true;
        }
        const redirect = REDIRECTS.find(([op]) => rest.startsWith(op));
        if (redirect) {
            this.#redirectOp(redirect);
            return true;
        }
        const separator = SEPARATORS.find(([op]) => rest.startsWith(op));
        if (separator) {
            this.#endWord();
            this.#mark(separator[1], this.#i);
            this.#separate(separator[0]);
            this.#i += separator[0].length;
            return true;
        }
        if (c === '(' || c === ')') {
            this.#paren(c);
            return true;
        }
        return false;
    }
    #redirectOp([op, kind]) {
        const word = this.#word;
        const fd = word !== null && FD.test(word.raw) ? word.text : '';
        if (fd) {
            this.#word = null;
        }
        else {
            this.#endWord();
        }
        this.#mark(kind, this.#i);
        if (op === '<<' || op === '<<-') {
            this.#reason ??= 'heredoc';
        }
        this.#redirect = { fd, op };
        this.#i += op.length;
    }
    #paren(c) {
        const words = this.#command.argv.length + (this.#word === null ? 0 : 1);
        this.#endWord();
        const defines = c === '(' && words === 1 && /^\(\s*\)/.test(this.#line.slice(this.#i));
        this.#mark(defines ? 'function' : 'subshell', this.#i);
        this.#endCommand();
        this.#i++;
    }
    #newline() {
        this.#endWord();
        if (BLANK.test(this.#line.slice(this.#i))) {
            this.#i = this.#line.length;
            return;
        }
        this.#mark('newline', this.#i);
        this.#separate('\n');
        this.#i++;
    }
    #comment() {
        this.#mark('comment', this.#i);
        const end = this.#line.indexOf('\n', this.#i);
        this.#i = end === -1 ? this.#line.length : end;
    }
    #escaped() {
        const next = this.#line[this.#i + 1];
        if (next === '\n') {
            this.#mark('continuation', this.#i);
        }
        else {
            this.#literal(next ?? '\\', this.#line.slice(this.#i, this.#i + 2));
        }
        this.#i += 2;
    }
    #singleQuoted() {
        const end = this.#line.indexOf("'", this.#i + 1);
        if (end === -1) {
            this.#mark('unterminated', this.#i);
        }
        const stop = end === -1 ? this.#line.length : end;
        this.#literal(this.#line.slice(this.#i + 1, stop), this.#line.slice(this.#i, stop + 1));
        this.#i = stop + 1;
    }
    #doubleQuoted() {
        const open = this.#i;
        let text = '';
        this.#i++;
        while (this.#i < this.#line.length && this.#line[this.#i] !== '"') {
            text += this.#quotedChar();
        }
        if (this.#i >= this.#line.length) {
            this.#mark('unterminated', open);
        }
        this.#i++;
        this.#literal(text, this.#line.slice(open, this.#i));
    }
    #quotedChar() {
        const c = this.#line.charAt(this.#i);
        if (c === '\\') {
            const next = this.#line[this.#i + 1];
            if (next === '\n') {
                this.#mark('continuation', this.#i);
            }
            this.#i += 2;
            if (next === undefined || next === '\n') {
                return next === undefined ? c : '';
            }
            return '$`"\\'.includes(next) ? next : c + next;
        }
        if (c === '$' || c === '`') {
            this.#mark(c === '$' ? 'expansion' : 'backtick', this.#i);
        }
        this.#i++;
        return c;
    }
    #literal(text, raw) {
        const word = this.#open();
        word.text += text;
        word.raw += raw;
        word.unquoted += QUOTED.repeat(text.length);
        word.plain = false;
    }
    #bare(c) {
        const word = this.#open();
        word.text += c;
        word.raw += c;
        word.unquoted += c;
        this.#i++;
    }
    #open() {
        this.#word ??= { text: '', raw: '', unquoted: '', plain: true };
        return this.#word;
    }
    #endWord() {
        const word = this.#word;
        this.#word = null;
        if (word === null) {
            return;
        }
        if (this.#redirect) {
            this.#command.redirects.push({ ...this.#redirect, target: word.text });
            this.#redirect = null;
            return;
        }
        if (this.#command.argv.length === 0 && this.#prefix(word)) {
            return;
        }
        if (this.#command.argv.length === 0 && REINTERPRETS.has(word.text)) {
            this.#mark('eval', this.#start);
        }
        this.#command.argv.push(word.text);
        this.#command.expands.push(expands(word.unquoted));
    }
    #prefix(word) {
        if (ASSIGNMENT.test(word.raw)) {
            this.#command.assignments.push(word.text);
            return true;
        }
        const kind = word.plain ? RESERVED.get(word.text) : undefined;
        if (kind) {
            this.#mark(kind, this.#start);
            return true;
        }
        return false;
    }
    #separate(op) {
        this.#endCommand();
        this.ops.push(op);
    }
    #endCommand() {
        const { argv, assignments, redirects } = this.#command;
        if (evaluates(argv)) {
            this.#mark('eval', this.#start);
        }
        if (argv.length > 0 || assignments.length > 0 || redirects.length > 0) {
            this.commands.push(this.#command);
        }
        this.#command = emptyCommand();
        this.#redirect = null;
    }
    #mark(kind, at) {
        this.constructs.push({ kind, at });
        this.#reason ??= UNJUDGEABLE[kind] ?? null;
    }
}
