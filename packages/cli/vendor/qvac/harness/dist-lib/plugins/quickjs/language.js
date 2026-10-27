const NAME = 'javascript';
const NOT_JAVASCRIPT = ['packages', 'inputs', 'outputs', 'script', 'skill', 'scriptArgs', 'workdir'];
const TEXT = {
    runs: 'JavaScript in a sandboxed QuickJS interpreter',
    guide: 'For JavaScript: pass language="javascript" with the source in command; it has no files, network or modules.',
    command: '— when language is javascript — the JavaScript source itself',
    language: '"javascript" runs command as JavaScript in QuickJS.',
    workdir: 'never with language "javascript"',
    download: '',
    properties: {},
    prompt: {
        runs: 'JavaScript source in `command` with language="javascript"',
        guide: 'JavaScript has no files, network or modules.',
        command: 'JavaScript source when language="javascript"',
        language: '"javascript" runs `command` as JavaScript',
        properties: {}
    }
};
const NODE_EVAL = /^\s*node\s+(-e|--eval)\b/;
export function createJavaScriptLanguage(interpreter) {
    return {
        name: NAME,
        text: TEXT,
        call(args) {
            const language = typeof args.language === 'string' ? args.language.trim().toLowerCase() : '';
            return language === NAME ? { args } : null;
        },
        effect: () => 'read',
        scope: () => null,
        validate(args) {
            const stray = NOT_JAVASCRIPT.find((each) => args[each] !== undefined && args[each] !== null);
            return stray
                ? `${stray} is not an argument here: a javascript call takes only command, language, timeoutMs and maxOutputChars`
                : null;
        },
        label: (args) => `javascript: ${String(args.command ?? '')
            .trim()
            .slice(0, 120)}`,
        online: () => false,
        redirect(args) {
            return NODE_EVAL.test(String(args.command ?? ''))
                ? 'node is not available here. Call exec again with language "javascript" and the bare JavaScript source in command.'
                : null;
        },
        strays: () => null,
        resolve(args, ctx) {
            return {
                run: ({ timeoutMs, maxOutputChars, signal }) => {
                    const remaining = ctx?.runBudget ? ctx.runBudget.deadlineMs - Date.now() : Infinity;
                    return interpreter.evaluate(String(args.command ?? ''), {
                        timeoutMs: Math.min(timeoutMs ?? Infinity, remaining),
                        maxOutputChars,
                        signal
                    });
                }
            };
        }
    };
}
