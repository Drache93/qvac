import b4a from 'b4a';
import { spawn } from 'child_process';
import process from 'process';
import { errorMessage, isRecord } from '../../lib/guards.js';
import { execEnv } from '../../lib/helpers/spawn-path.js';
import { HarnessLog } from '../../lib/log.js';
import { PluginRegistry } from '../../lib/plugins/index.js';
const DEFAULT_TIMEOUT_S = 60;
const STDERR_TAIL = 2_000;
const SUBAGENT_MATCHER = 'delegate';
const EVENTS = {
    PreToolUse: 'preToolCall',
    PostToolUse: 'postToolCall',
    PostToolUseFailure: 'toolFailure',
    UserPromptSubmit: 'promptSubmit',
    Stop: 'stop',
    PreCompact: 'preFold',
    SubagentStart: 'preToolCall',
    SubagentStop: 'postToolCall'
};
const SKIPPED = ['SessionStart', 'SessionEnd', 'Notification', 'PermissionRequest'];
function isEvent(key) {
    return Object.hasOwn(EVENTS, key);
}
function isSkipped(key) {
    return SKIPPED.some((event) => event === key);
}
function wildcard(matcher) {
    return !matcher || matcher === '*';
}
function toolEvent(event) {
    return event === 'PreToolUse' || event === 'PostToolUse' || event === 'PostToolUseFailure';
}
function regexError(matcher) {
    try {
        new RegExp(`^(?:${matcher})$`);
        return null;
    }
    catch (err) {
        return errorMessage(err);
    }
}
function commandError(event, hook) {
    if (!isRecord(hook) || hook.type !== 'command') {
        return `${event}: only type "command" is supported`;
    }
    if (typeof hook.command !== 'string' || !hook.command.trim()) {
        return `${event}: a command is empty`;
    }
    const { timeout } = hook;
    if (timeout !== undefined && !(typeof timeout === 'number' && timeout > 0)) {
        return `${event}: a timeout must be above 0`;
    }
    return null;
}
function entryError(event, entry) {
    if (!isRecord(entry) || !Array.isArray(entry.hooks)) {
        return `${event}: each entry needs a hooks list`;
    }
    const { matcher } = entry;
    if (event.startsWith('Subagent') && typeof matcher === 'string' && !wildcard(matcher)) {
        return `${event}: matcher '${matcher}' names an agent type, and a delegate call has none`;
    }
    const invalid = toolEvent(event) && typeof matcher === 'string' && !wildcard(matcher);
    const error = invalid ? regexError(matcher) : null;
    if (error) {
        return `${event}: matcher '${matcher}' is not a valid regex: ${error}`;
    }
    for (const hook of entry.hooks) {
        const error = commandError(event, hook);
        if (error) {
            return error;
        }
    }
    return null;
}
function outcomeMessage(outcome) {
    if (outcome.kind === 'success')
        return undefined;
    return outcome.kind === 'error' || outcome.kind === 'guidance' ? outcome.message : outcome.reason;
}
function stdinOf(ctx, base, active) {
    switch (ctx.phase) {
        case 'preToolCall':
            return { ...base, tool_name: ctx.toolName, tool_input: ctx.args, tool_use_id: ctx.callId };
        case 'postToolCall':
        case 'toolFailure':
            return {
                ...base,
                tool_name: ctx.toolName,
                tool_input: ctx.args,
                tool_use_id: ctx.callId,
                tool_response: ctx.result,
                error: ctx.phase === 'toolFailure' ? outcomeMessage(ctx.outcome) : undefined
            };
        case 'promptSubmit':
            return { ...base, prompt: ctx.text };
        case 'stop':
            return { ...base, stop_hook_active: active };
        case 'preFold':
            return { ...base, trigger: 'auto', custom_instructions: '' };
        default:
            return base;
    }
}
function text(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function blocked(event, reason) {
    const said = reason ?? `${event} hook blocked this`;
    switch (event) {
        case 'PreToolUse':
        case 'SubagentStart':
        case 'UserPromptSubmit':
            return { kind: 'hook-rejection', error: said, guidance: true };
        case 'PostToolUse':
        case 'PostToolUseFailure':
        case 'SubagentStop':
            return { context: said };
        case 'Stop':
            return { continue: said };
        case 'PreCompact':
            HarnessLog.info('PreCompact hook exited 2; a fold cannot be blocked', { reason: said });
            return undefined;
    }
}
function parsed(stdout) {
    const trimmed = stdout.trim();
    if (!trimmed.startsWith('{')) {
        return null;
    }
    try {
        const value = JSON.parse(trimmed);
        return isRecord(value) ? value : null;
    }
    catch {
        return null;
    }
}
function permissionOf(value) {
    return value === 'allow' || value === 'deny' || value === 'ask' ? value : undefined;
}
function fromJson(event, json) {
    if (json.decision === 'block' && event !== 'PreCompact') {
        return blocked(event, text(json.reason));
    }
    const specific = isRecord(json.hookSpecificOutput) ? json.hookSpecificOutput : {};
    const extra = text(specific.additionalContext);
    if (event === 'PreToolUse' || event === 'SubagentStart') {
        const args = specific.updatedInput;
        return {
            args: isRecord(args) && !Array.isArray(args) ? args : undefined,
            permission: permissionOf(specific.permissionDecision),
            reason: text(specific.permissionDecisionReason) ?? text(json.reason)
        };
    }
    if (event === 'Stop' || extra === undefined) {
        return undefined;
    }
    return event === 'PreCompact' ? { instructions: extra } : { context: extra };
}
function answered(event, exit) {
    const json = exit.code === 0 ? parsed(exit.stdout) : null;
    if (json?.continue === false) {
        return { halt: text(json.stopReason) ?? `${event} hook stopped the run` };
    }
    if (exit.code === 2) {
        return blocked(event, text(exit.stderr));
    }
    if (exit.code !== 0) {
        const tail = text(exit.stderr);
        throw new Error(`command exited ${exit.code ?? 'on a signal'}${tail ? `: ${tail}` : ''}`);
    }
    if (json) {
        return fromJson(event, json);
    }
    const plain = text(exit.stdout);
    if (event === 'UserPromptSubmit' && plain !== undefined) {
        return { context: plain };
    }
    return event === 'PreCompact' && plain !== undefined ? { instructions: plain } : undefined;
}
const spawnCommand = (command, { cwd, env }) => spawn('/bin/sh', ['-c', command], { cwd, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
function abortedError(signal) {
    const reason = signal?.reason;
    return reason instanceof Error ? reason : new Error('command aborted');
}
function killOnAbort(child, signals, fail) {
    const listening = signals.flatMap((signal) => signal ? [{ signal, listener: () => abort(signal) }] : []);
    const detach = () => {
        for (const { signal, listener } of listening) {
            signal.removeEventListener('abort', listener);
        }
    };
    const abort = (signal) => {
        detach();
        try {
            if (child.pid) {
                process.kill(-child.pid, 'SIGKILL');
            }
        }
        catch {
        }
        fail(abortedError(signal));
    };
    for (const { signal, listener } of listening) {
        if (signal.aborted) {
            abort(signal);
            break;
        }
        signal.addEventListener('abort', listener);
    }
    return detach;
}
function run(child, input, signals) {
    const stdout = [];
    const stderr = [];
    child.stdout?.on('data', (chunk) => stdout.push(chunk));
    child.stderr?.on('data', (chunk) => stderr.push(chunk));
    child.stdin?.on('error', () => { });
    child.stdin?.write(JSON.stringify(input));
    child.stdin?.end();
    return new Promise((resolve, reject) => {
        const detach = killOnAbort(child, signals, reject);
        child.on('error', (error) => {
            detach();
            reject(error);
        });
        child.on('close', (code) => {
            detach();
            resolve({
                code,
                stdout: b4a.toString(b4a.concat(stdout), 'utf8'),
                stderr: b4a.toString(b4a.concat(stderr), 'utf8').slice(-STDERR_TAIL)
            });
        });
    });
}
function commandsOf(event, entries) {
    return entries
        .flatMap(({ matcher, hooks }) => hooks.map(({ command, timeout }) => ({ matcher, command, timeout })))
        .map((hook, i) => ({ ...hook, event, name: `${event}:${i + 1}` }))
        .filter(({ matcher }) => event !== 'PreCompact' || wildcard(matcher) || matcher === 'auto');
}
function matcherOf(event, matcher) {
    if (event === 'SubagentStart' || event === 'SubagentStop') {
        return SUBAGENT_MATCHER;
    }
    return toolEvent(event) ? matcher : undefined;
}
export class CommandHooks {
    static EVENTS = EVENTS;
    static spawn = spawnCommand;
    name = 'command-hooks';
    api = PluginRegistry.API_VERSION;
    addons = { 'bare-subprocess': () => import('bare-subprocess') };
    _hooks;
    _cwd;
    _spawn;
    _stops = new Map();
    constructor(hooks, options = {}) {
        this._hooks = hooks;
        this._cwd = options.cwd ?? process.cwd();
        this._spawn = options.spawn ?? spawnCommand;
    }
    validate() {
        const config = this._hooks;
        if (!isRecord(config)) {
            return 'config must be the hooks object of a settings.json';
        }
        for (const [event, entries] of Object.entries(config)) {
            if (isSkipped(event)) {
                continue;
            }
            if (!isEvent(event)) {
                return `unknown event '${event}'; supported: ${Object.keys(EVENTS).join(', ')}`;
            }
            if (!Array.isArray(entries)) {
                return `${event} must be a list of matcher entries`;
            }
            for (const entry of entries) {
                const error = entryError(event, entry);
                if (error) {
                    return error;
                }
            }
        }
        return null;
    }
    setup() {
        const config = this._hooks;
        const skipped = Object.keys(config).filter(isSkipped);
        if (skipped.length) {
            HarnessLog.info('command-hooks: these events have no harness phase and never run', {
                events: skipped
            });
        }
        const commands = Object.entries(config).flatMap(([event, entries = []]) => isEvent(event) ? commandsOf(event, entries) : []);
        const hooks = commands.map((spec) => ({
            name: spec.name,
            phase: EVENTS[spec.event],
            matcher: matcherOf(spec.event, spec.matcher),
            timeoutMs: (spec.timeout ?? DEFAULT_TIMEOUT_S) * 1000,
            run: (ctx, options) => this._run(spec, ctx, options?.signal)
        }));
        if (commands.some(({ event }) => event === 'Stop')) {
            hooks.push({
                name: 'Stop:end',
                phase: 'runEnd',
                run: (ctx) => void this._stops.delete(ctx.runId)
            });
        }
        return { hooks, teardown: () => this._stops.clear() };
    }
    async _run(spec, ctx, signal) {
        if (ctx.phase === 'postToolCall' && ctx.outcome?.kind !== 'success') {
            return undefined;
        }
        const stop = ctx.phase === 'stop' ? this._stopState(ctx.runId, ctx.round) : null;
        const env = { ...execEnv(process.env, process.platform), CLAUDE_PROJECT_DIR: this._cwd };
        const base = { hook_event_name: spec.event, session_id: ctx.runId, cwd: this._cwd };
        const input = stdinOf(ctx, base, stop?.active ?? false);
        const signals = [signal, ctx.phase === 'preToolCall' ? ctx.signal : undefined];
        const exit = await run(this._spawn(spec.command, { cwd: this._cwd, env }), input, signals);
        const result = answered(spec.event, exit);
        if (stop) {
            stop.continued ||= isRecord(result) && 'continue' in result;
        }
        return result;
    }
    _stopState(runId, round) {
        const prior = this._stops.get(runId);
        if (prior?.round === round) {
            return prior;
        }
        const state = { round, active: prior?.continued ?? false, continued: false };
        this._stops.set(runId, state);
        return state;
    }
}
