import path from 'path';
import { Policy } from '../../policy/index.js';
import { detachJson } from '../../helpers/detach-json.js';
import { compileGlob } from '../../tools/fs/glob.js';
import { ShellLine } from '../../tools/exec/shell-line.js';
const FD_DUP = /^(\d+|-)$/;
export class PolicyRulesHook {
    name = 'policy-rules';
    phase = 'preToolCall';
    rules;
    constructor(rules) {
        this.rules = detachJson(rules);
    }
    run(ctx) {
        if (ctx.phase !== 'preToolCall')
            return;
        const rules = this.rules.filter((rule) => applies(rule, ctx));
        if (rules.length === 0) {
            return;
        }
        const fold = new Fold();
        for (const rule of rules.filter((each) => !each.command)) {
            fold.add(rule, callVerdict(rule, ctx));
        }
        const commandRules = rules.filter((each) => each.command);
        const text = commandRules.length ? (ctx.command?.(ctx.args) ?? null) : null;
        if (text !== null) {
            fold.line(ShellLine.parse(text), commandRules);
        }
        return fold.result();
    }
}
class Fold {
    denied = null;
    asked = false;
    unknown = false;
    allowed = false;
    add(rule, verdict) {
        if (verdict === 'unknown') {
            this.unknown = true;
        }
        else if (verdict === 'match') {
            this.#matched(rule);
        }
    }
    line(line, rules) {
        this.unknown ||= line.unjudgeable !== null;
        let every = line.commands.length > 0;
        for (const part of line.commands) {
            let allowed = false;
            for (const rule of rules) {
                const verdict = commandVerdict(rule, part);
                if (rule.decision === 'allow' && verdict === 'match') {
                    allowed = true;
                }
                else {
                    this.add(rule, verdict);
                }
            }
            every &&= allowed;
        }
        this.allowed ||= every;
    }
    result() {
        if (this.denied) {
            return { permission: 'deny', reason: `a policy rule denies this call: ${label(this.denied)}` };
        }
        if (this.unknown || this.asked) {
            return { permission: 'ask' };
        }
        return this.allowed ? { permission: 'allow' } : undefined;
    }
    #matched(rule) {
        if (rule.decision === 'deny') {
            this.denied ??= rule;
        }
        else if (rule.decision === 'ask') {
            this.asked = true;
        }
        else {
            this.allowed = true;
        }
    }
}
function applies(rule, ctx) {
    const named = rule.tool === undefined || rule.tool === ctx.toolName;
    const read = rule.command ? ctx.command : !rule.paths || ctx.paths;
    return named && Boolean(read) && (!rule.hosts || ctx.egress !== undefined);
}
function callVerdict(rule, ctx) {
    const verdicts = [];
    if (rule.paths) {
        const globs = rule.paths.map(pathGlob);
        const paths = ctx.paths?.(ctx.args) ?? [];
        verdicts.push(over(rule, paths.map((each) => pathVerdict(each, globs))));
    }
    if (rule.hosts) {
        const { hosts } = rule;
        const targets = ctx.egress?.(ctx.args) ?? [];
        const urls = typeof targets === 'string' ? [targets] : targets;
        verdicts.push(over(rule, urls.map((url) => hostVerdict(url, hosts))));
    }
    return every(verdicts);
}
function commandVerdict(rule, part) {
    const prefix = rule.command ?? [];
    const { argv, expands } = part;
    if (expands[0]) {
        return 'unknown';
    }
    const named = rule.decision === 'allow'
        ? argv[0] === prefix[0]
        : program(argv[0] ?? '') === program(prefix[0] ?? '');
    if (!named) {
        return 'no';
    }
    const expanding = prefix.findIndex((_word, i) => expands[i]);
    const differs = prefix.findIndex((word, i) => i > 0 && argv[i] !== word);
    if (expanding !== -1 && (differs === -1 || expanding <= differs)) {
        return 'unknown';
    }
    if (differs !== -1) {
        return 'no';
    }
    if (rule.decision === 'allow' && (part.assignments.length || part.redirects.some(writesFile))) {
        return 'no';
    }
    return rule.paths ? over(rule, wordVerdicts(part, prefix.length, rule.paths)) : 'match';
}
function wordVerdicts({ argv, expands }, from, patterns) {
    const globs = patterns.map(pathGlob);
    return argv.slice(from).flatMap((word, i) => {
        const option = word.startsWith('--') && word.includes('=');
        if (word.startsWith('-') && !option) {
            return [];
        }
        const value = option ? word.slice(word.indexOf('=') + 1) : word;
        return [expands[from + i] ? 'unknown' : pathVerdict(value, globs)];
    });
}
function pathGlob(pattern) {
    return compileGlob(path.posix.normalize(pattern));
}
function pathVerdict(word, globs) {
    if (word.split(/[/\\]/).includes('..')) {
        return 'unknown';
    }
    const normal = path.posix.normalize(word);
    return globs.some((glob) => glob(normal)) ? 'match' : 'no';
}
function hostVerdict(target, hosts) {
    let host;
    try {
        host = new URL(target).hostname;
    }
    catch {
        return 'unknown';
    }
    return Policy.allowsHost(hosts, host) ? 'match' : 'no';
}
function over(rule, verdicts) {
    if (rule.decision !== 'allow') {
        return some(verdicts);
    }
    return verdicts.length ? every(verdicts) : 'no';
}
function every(verdicts) {
    if (verdicts.includes('no')) {
        return 'no';
    }
    return verdicts.includes('unknown') ? 'unknown' : 'match';
}
function some(verdicts) {
    if (verdicts.includes('match')) {
        return 'match';
    }
    return verdicts.includes('unknown') ? 'unknown' : 'no';
}
function program(word) {
    return word
        .replace(/^.*[/\\]/, '')
        .replace(/\.exe$/i, '')
        .toLowerCase();
}
function writesFile({ op, target }) {
    return !((op === '>&' || op === '<&') && FD_DUP.test(target));
}
function label(rule) {
    return [rule.tool, rule.command?.join(' '), rule.paths?.join(', '), rule.hosts?.join(', ')]
        .filter(Boolean)
        .join(' ');
}
