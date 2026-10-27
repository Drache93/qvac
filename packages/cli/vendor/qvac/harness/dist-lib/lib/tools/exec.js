import { createHash } from 'crypto';
import { Policy } from '../policy/index.js';
import { AbortedError } from '../helpers/race-abort.js';
import { createShellAdapter } from './exec/adapters/shell/shell-adapter.js';
import { isPythonLanguage } from './exec/python-source.js';
import { MAX_OUTPUT_CHARS, MAX_OUTPUT_CHARS_LIMIT } from './exec/runner.js';
import { bareBin, sanitizeCommand } from './exec/scope.js';
import { LANGUAGE_UNAVAILABLE_ERROR, PYTHON_UNAVAILABLE_ERROR, SHELL_DOWNLOAD_NOTE, shellOnlyError, videoToolError } from './exec/shell-guidance.js';
import { ShellLine } from './exec/shell-line.js';
import { bareRuntime } from './exec/bare-runtime.js';
import { canonicalDenyRoots, defaultRealpath, hostPath, resolveKey } from './fs/scope.js';
import { settingsEnv } from './skills/skill-settings.js';
import { checkCliOps } from './skills/cli-schema.js';
function parsePositiveInt(value, name, max) {
    if (value === undefined || value === null || value === '')
        return undefined;
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(n) || n <= 0 || n > max) {
        return { error: `${name} must be a positive integer ≤ ${max}` };
    }
    return n;
}
function resolveShellOps(line, toolOps) {
    const [program = '', ...argv] = line.commands[0]?.argv ?? [];
    const bin = bareBin(program);
    return { ops: (bin ? toolOps?.get(bin) : undefined) ?? [], argv };
}
function checkShellScope(command, toolOps) {
    const unsafe = sanitizeCommand(command);
    if (unsafe) {
        return unsafe;
    }
    const { ops, argv } = resolveShellOps(ShellLine.parse(command), toolOps);
    if (ops.length === 0) {
        return null;
    }
    return checkCliOps(argv, ops);
}
function shellEffect(command, toolOps) {
    const line = ShellLine.parse(command);
    const [first] = line.commands;
    if (line.unjudgeable ||
        line.ops.length > 0 ||
        first?.redirects.length ||
        first?.assignments.length) {
        return 'write';
    }
    const { ops, argv } = resolveShellOps(line, toolOps);
    const matched = ops.filter((op) => op.check(argv) === null);
    if (matched.length === 0) {
        return 'write';
    }
    return matched.every((op) => op.annotation(argv) === 'read') ? 'read' : 'write';
}
function shellOutputCap(command, toolOps) {
    const { ops, argv } = resolveShellOps(ShellLine.parse(command), toolOps);
    const caps = ops.map((op) => op.outputCap(argv)).filter((cap) => cap !== undefined);
    return caps.length > 0 ? Math.min(...caps) : undefined;
}
const CUT_MARKER = /(…\[\d+ chars omitted[^\]]*)\]…/;
function noteCeiling(result, ceiling) {
    if (!result || typeof result !== 'object')
        return result;
    const out = { ...result };
    for (const stream of ['stdout', 'stderr']) {
        const text = out[stream];
        if (typeof text === 'string') {
            out[stream] = text.replace(CUT_MARKER, `$1; this skill limits this command to ${ceiling} characters, a larger maxOutputChars does not apply]…`);
        }
    }
    return out;
}
function cappedOutput(requested, ceiling) {
    if (ceiling === undefined)
        return requested;
    return Math.min(requested ?? MAX_OUTPUT_CHARS, ceiling);
}
function stringList(value) {
    if (!Array.isArray(value))
        return undefined;
    return value.filter((v) => typeof v === 'string');
}
function firstAnswer(languages, answer) {
    for (const language of languages) {
        const found = answer(language);
        if (found) {
            return found;
        }
    }
    return null;
}
function resolveCall(rawArgs, languages) {
    const name = languageName(rawArgs.language);
    const ordered = [...languages].sort((a, b) => Number(b.name === name) - Number(a.name === name));
    for (const language of ordered) {
        const call = language.call(rawArgs);
        if (call) {
            return 'error' in call ? call : { ...call, language };
        }
    }
    if (isPythonLanguage(rawArgs.language)) {
        return { error: PYTHON_UNAVAILABLE_ERROR };
    }
    return namesShell(rawArgs.language) ? { args: rawArgs } : { error: LANGUAGE_UNAVAILABLE_ERROR };
}
function languageName(language) {
    return typeof language === 'string' ? language.trim().toLowerCase() : '';
}
const SHELL_NAMES = new Set(['', 'shell', 'bash', 'sh', 'zsh']);
function namesShell(language) {
    return SHELL_NAMES.has(languageName(language));
}
const NOT_SHELL = ['packages', 'inputs', 'outputs', 'script'];
function shellStray(args) {
    const name = NOT_SHELL.find((each) => args[each] !== undefined && args[each] !== null);
    return name
        ? `${name} is not an argument here: a shell call takes only command, workdir, timeoutMs and maxOutputChars`
        : null;
}
function loadRun(call, skillsDir) {
    return call.bundled ? call.bundled.load(skillsDir) : { args: call.args, trusted: false };
}
const WORKDIR_NO_ROOTS_ERROR = 'workdir is not available: no directories are granted to this device, so a working directory ' +
    'cannot be validated. Omit workdir and use absolute paths in the command.';
function checkExecutionScope(args, language, { toolOps, sandbox, languages }) {
    if (language) {
        return language.scope(args, { sandbox });
    }
    const command = String(args.command ?? '').trim();
    const video = videoToolError(command, {
        packages: stringList(args.packages),
        python: false,
        network: languages.some((each) => each.online({ sandbox }))
    });
    return (video ??
        firstAnswer(languages, (each) => each.redirect(args, { sandbox })) ??
        shellOnlyError(command) ??
        checkShellScope(command, toolOps));
}
async function skillsEnv(skillSettings, skillEnv, ctx) {
    const skills = ctx?.skills ?? [];
    if (skills.length === 0) {
        return undefined;
    }
    const env = {};
    for (const skill of skills) {
        if (skillSettings) {
            Object.assign(env, settingsEnv(skill, await skillSettings(skill, ctx?.agentId)));
        }
        Object.assign(env, declaredEnv(skillEnv?.(skill), ctx?.session));
    }
    return Object.keys(env).length > 0 ? env : undefined;
}
export function declaredEnv(declared, session) {
    const env = {};
    for (const [name, value] of Object.entries(declared ?? {})) {
        if (!value.includes('${session}')) {
            env[name] = value;
        }
        else if (session) {
            env[name] = value.replaceAll('${session}', session);
        }
    }
    return env;
}
function execSchema(languages) {
    const text = languages.map((language) => language.text);
    const runs = (each) => text.map((t) => `, or ${each(t)}`).join('');
    const language = text.length
        ? {
            language: {
                type: 'string',
                description: `Optional runtime. ${text.map((t) => t.language).join(' ')} Default is shell.`
            }
        }
        : {};
    const promptLanguage = text.length
        ? {
            language: {
                type: 'string',
                enum: ['shell', ...languages.map((each) => each.name)],
                description: `${text.map((t) => t.prompt.language).join('; ')}; default shell.`
            }
        }
        : {};
    const workdir = text.length
        ? ` on the shell path${text.map((t) => `, ${t.workdir}`).join('')}`
        : '';
    return {
        description: `Execute a shell command on the user's device${runs((t) => t.runs)}. ` +
            'One program per call: chaining, pipes, redirection and shell expansion are rejected. ' +
            'Returns stdout, stderr, and exit code. ' +
            text.map((t) => `${t.guide} `).join('') +
            'Prefer one-shot commands; do not use for long-running daemons.',
        parameters: {
            type: 'object',
            properties: {
                command: { type: 'string', description: `Shell command${runs((t) => t.command)}` },
                ...language,
                ...Object.assign({}, ...text.map((t) => t.properties)),
                workdir: {
                    type: 'string',
                    description: `Optional working directory: a host path${workdir}.`
                },
                timeoutMs: {
                    type: 'number',
                    description: 'Optional timeout in milliseconds (default 120000, max 600000)'
                },
                maxOutputChars: {
                    type: 'number',
                    description: 'Optional stdout/stderr cap in characters (default 8192, max 65536); longer output keeps its start and end. Raise when reading long content, e.g. a full note. A skill may cap one of its commands lower; the truncation note says so, and raising this does not lift that cap.'
                }
            },
            required: []
        },
        prompt: {
            description: `Run one program on the user's device: a shell command${runs((t) => t.prompt.runs)}. ` +
                'Chaining, pipes, redirection and shell expansion are rejected. ' +
                `Returns stdout, stderr, exit code.${text.map((t) => ` ${t.prompt.guide}`).join('')}`,
            parameters: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: `Shell command${runs((t) => t.prompt.command)}.`
                    },
                    ...promptLanguage,
                    ...Object.assign({}, ...text.map((t) => t.prompt.properties)),
                    workdir: { type: 'string' },
                    timeoutMs: { type: 'number', description: 'default 120000, max 600000.' },
                    maxOutputChars: {
                        type: 'number',
                        description: 'stdout/stderr cap (default 8192, max 65536), keeping start and end; raise for long content.'
                    }
                },
                required: []
            }
        }
    };
}
export function createExecTool({ policyVersion, spawn, killProcess, shell: composedShell, languages = [], routes = [], skillSettings, skillEnv, realpath = defaultRealpath, deniedRoots, skillsDir } = {}) {
    const shell = composedShell ??
        createShellAdapter({
            spawn,
            killProcess,
            loadRuntime: bareRuntime,
            downloadNote: [SHELL_DOWNLOAD_NOTE, ...languages.map((each) => each.text.download)]
                .filter(Boolean)
                .join(' ')
        });
    const commandRequired = (args, scope, language) => firstAnswer(languages, (each) => each.redirect(args, scope)) ??
        (language ? null : shellStray(args)) ??
        'command is required';
    return {
        name: 'exec',
        policyVersion: createHash('sha256')
            .update(JSON.stringify({
            version: 2,
            policyVersion: policyVersion ?? null,
            shell: shell.name,
            languages: languages.map((each) => each.name),
            routes: routes.map((each) => each.name),
            deniedRoots: [...(deniedRoots ?? [])].sort(),
            skillsDir: skillsDir ?? null
        }))
            .digest('hex'),
        toolset: 'exec',
        addons: { 'bare-subprocess': bareRuntime },
        ...execSchema(languages),
        autoApprove: false,
        effect(rawArgs, ctx) {
            const call = resolveCall(rawArgs, languages);
            if ('error' in call) {
                return 'write';
            }
            if (call.bundled) {
                return 'read';
            }
            if (call.language) {
                return call.language.effect(call.args);
            }
            return shellEffect(String(call.args.command ?? '').trim(), ctx?.toolOps);
        },
        command(rawArgs) {
            const call = resolveCall(rawArgs, languages);
            return 'error' in call || call.language || call.bundled
                ? null
                : String(call.args.command ?? '');
        },
        validate(args, ctx) {
            const call = resolveCall(args, languages);
            if ('error' in call) {
                return call.error;
            }
            const run = loadRun(call, skillsDir);
            if ('error' in run) {
                return run.error;
            }
            const { language } = call;
            const rawArgs = run.args;
            const sandbox = ctx?.policy?.network.mode === 'off';
            const command = String(rawArgs.command ?? '').trim();
            if (!command) {
                return commandRequired(rawArgs, { sandbox }, language);
            }
            const scopeError = checkExecutionScope(rawArgs, language, {
                toolOps: ctx?.toolOps,
                sandbox,
                languages
            });
            if (scopeError) {
                return scopeError;
            }
            const workdirGiven = rawArgs.workdir !== undefined && rawArgs.workdir !== null;
            if (workdirGiven && !language && (ctx?.fsRoots ?? []).length === 0) {
                return WORKDIR_NO_ROOTS_ERROR;
            }
            if (language) {
                return language.validate(rawArgs, {
                    sandbox,
                    trusted: run.trusted,
                    toolNames: ctx?.toolNames
                });
            }
            return firstAnswer(languages, (each) => each.strays(rawArgs)) ?? shellStray(rawArgs);
        },
        resource(rawArgs, ctx) {
            const call = resolveCall(rawArgs, languages);
            if ('error' in call) {
                return null;
            }
            if (call.bundled) {
                return { kind: 'command', label: call.bundled.label };
            }
            const { args } = call;
            const command = String(args.command ?? '').trim();
            if (!command) {
                return null;
            }
            const workdir = typeof args.workdir === 'string' && args.workdir.trim() ? args.workdir.trim() : null;
            const body = call.language
                ? call.language.label(args, { sandbox: ctx?.policy?.network.mode === 'off' })
                : command;
            return {
                kind: 'command',
                label: workdir ? `${body}  (cwd: ${workdir})` : body
            };
        },
        async execute(args, ctx) {
            const call = resolveCall(args, languages);
            if ('error' in call) {
                return { error: call.error };
            }
            const run = loadRun(call, skillsDir);
            if ('error' in run) {
                return { error: run.error };
            }
            const { language } = call;
            const rawArgs = run.args;
            const sandbox = ctx?.policy?.network.mode === 'off';
            const command = String(rawArgs.command ?? '').trim();
            if (!command) {
                return { error: commandRequired(rawArgs, { sandbox }, language) };
            }
            const scopeError = checkExecutionScope(rawArgs, language, {
                toolOps: ctx?.toolOps,
                sandbox,
                languages
            });
            if (scopeError) {
                return { error: scopeError };
            }
            const workdir = rawArgs.workdir === undefined || rawArgs.workdir === null
                ? undefined
                : String(rawArgs.workdir);
            const policy = ctx?.policy ?? Policy.compile(undefined, { write: localRoots(ctx?.fsWriteRoots) });
            const deny = await canonicalDenyRoots([...(deniedRoots ?? []), ...policy.files.deny], realpath);
            let cwd = workdir;
            if (workdir !== undefined && !language) {
                const roots = ctx?.fsRoots ?? [];
                if (roots.length === 0) {
                    return { error: WORKDIR_NO_ROOTS_ERROR };
                }
                const resolved = await resolveKey(workdir, roots, { realpath, deny });
                if ('error' in resolved) {
                    return { error: resolved.error };
                }
                if (resolved.root.kind !== 'local') {
                    return { error: 'workdir must be a local directory, not a drive' };
                }
                if (!resolved.exists) {
                    return { error: `workdir does not exist: ${workdir}` };
                }
                cwd = hostPath(resolved.root, resolved.key);
            }
            let timeout = parsePositiveInt(rawArgs.timeoutMs, 'timeoutMs', 600_000);
            if (timeout && typeof timeout === 'object') {
                return timeout;
            }
            if (ctx?.runBudget) {
                const remaining = ctx.runBudget.deadlineMs - Date.now();
                if (remaining <= 0) {
                    return {
                        error: 'run wall-clock budget exhausted; no time remains for this call',
                        guidance: true
                    };
                }
                if (timeout !== undefined) {
                    timeout = Math.min(timeout, remaining);
                }
            }
            const requestedCap = parsePositiveInt(rawArgs.maxOutputChars, 'maxOutputChars', MAX_OUTPUT_CHARS_LIMIT);
            if (requestedCap && typeof requestedCap === 'object') {
                return requestedCap;
            }
            const ceiling = language ? undefined : shellOutputCap(command, ctx?.toolOps);
            const maxOutputChars = cappedOutput(requestedCap, ceiling);
            const route = language ? undefined : routes.find((each) => each.claims(command));
            if (route) {
                return route.run(command, ctx, {
                    timeoutMs: timeout,
                    maxOutputChars,
                    signal: ctx?.signal,
                    runtime: spawn ? async () => ({ spawn, killProcess }) : bareRuntime
                });
            }
            const childEnv = await skillsEnv(skillSettings, skillEnv, ctx);
            try {
                const context = {
                    attach: ctx?.attach,
                    fetchAttachment: ctx?.fetchAttachment,
                    turnImages: ctx?.turnImages,
                    runBudget: ctx?.runBudget,
                    policy: { ...policy, files: { ...policy.files, deny: [...new Set(deny)] } },
                    toolNames: ctx?.toolNames,
                    approval: ctx?.approval,
                    askUser: ctx?.askUser
                };
                const execution = language?.resolve(rawArgs, context) ?? shell.resolve(rawArgs, context);
                const result = await execution.run({
                    cwd,
                    timeoutMs: timeout,
                    maxOutputChars,
                    signal: ctx?.signal,
                    env: childEnv,
                    spill: ctx?.spill
                });
                return ceiling !== undefined && maxOutputChars === ceiling
                    ? noteCeiling(result, ceiling)
                    : result;
            }
            catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                return {
                    error: error instanceof AbortedError || error.name === 'AbortError'
                        ? 'command aborted'
                        : error.message
                };
            }
        }
    };
}
function localRoots(roots) {
    return (roots ?? []).flatMap((each) => (each.kind === 'local' ? [each.root] : []));
}
