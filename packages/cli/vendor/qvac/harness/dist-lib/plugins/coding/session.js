import b4a from 'b4a';
import { randomBytes } from 'crypto';
import path from 'path';
import { Policy } from '../../lib/policy/index.js';
import { readsOnly } from './read-only.js';
import { HarnessError } from '../../lib/errors.js';
import { isRecord } from '../../lib/guards.js';
import { appendOutput, createCapturedOutput, formatOutput, MAX_OUTPUT_CHARS } from '../../lib/tools/exec/runner.js';
import { callDenyRoots, defaultRealpath, overlaps, resolveKey } from '../../lib/tools/fs/scope.js';
const STATE_DIR = '"$__qvac_dir"';
const SHELL_TIMEOUT_MS = 300_000;
const MAX_TIMEOUT_MS = 1_800_000;
const NO_WORKSPACE = 'the coding tools need one writable directory granted to the run, and it has none';
const DRIVE_WORKSPACE = 'the coding tools work in a local project folder, not a drive or a filesystem root';
const DENIED_WORKSPACE = 'the coding tools need a project folder that neither holds nor sits in a protected app folder';
const DRIVE_PATH = 'the coding tools take a local path inside the project, not a drive path';
const NOT_ISOLATED = 'the network is off and this sandbox is not isolated, so the coding tools are off';
const BUDGET_SPENT = 'run wall-clock budget exhausted; no time remains for this call';
export function guidance(error) {
    return { error, guidance: true };
}
export function isError(value) {
    return isRecord(value) && 'error' in value;
}
export function shellQuote(text) {
    return `'${text.split("'").join("'\\''")}'`;
}
export function errorText(error) {
    if (error instanceof Error) {
        return error.name === 'AbortError' || HarnessError.is(error, 'ABORTED')
            ? 'command aborted'
            : error.message;
    }
    return String(error);
}
function workspaceRoot(ctx) {
    const roots = ctx?.fsWriteRoots ?? [];
    if (roots.length === 0) {
        return guidance(NO_WORKSPACE);
    }
    if (roots.length > 1) {
        return guidance(`the coding tools work in one writable directory, and the run grants ${roots.length}`);
    }
    const [root] = roots;
    if (root.kind !== 'local' || path.dirname(root.root) === root.root) {
        return guidance(DRIVE_WORKSPACE);
    }
    return root;
}
async function workspaceKey(root, input) {
    if (input.includes('://')) {
        return { error: DRIVE_PATH };
    }
    const resolved = await resolveKey(path.resolve(root.root, input), [root], {
        realpath: defaultRealpath
    });
    return 'error' in resolved ? resolved : resolved.key;
}
async function workspacePath(root, input) {
    const key = await workspaceKey(root, input);
    return isError(key) ? key : path.join(root.root, ...key.split('/').filter(Boolean));
}
export async function capped(text, stream, ctx) {
    const output = createCapturedOutput(MAX_OUTPUT_CHARS, ctx?.spill?.sink(stream));
    appendOutput(output, text);
    return formatOutput(output, await output.sink?.close());
}
async function cappedResult({ stdout, stderr, exitCode }, ctx) {
    return {
        stdout: await capped(stdout, 'stdout', ctx),
        stderr: await capped(stderr, 'stderr', ctx),
        exitCode
    };
}
function callTimeout(raw, ctx) {
    if (raw !== undefined && !(typeof raw === 'number' && Number.isFinite(raw) && raw > 0)) {
        return { error: 'timeoutMs must be a positive number' };
    }
    let timeout = Math.min(raw ?? SHELL_TIMEOUT_MS, MAX_TIMEOUT_MS);
    if (ctx?.runBudget) {
        const remaining = ctx.runBudget.deadlineMs - Date.now();
        if (remaining <= 0) {
            return guidance(BUDGET_SPENT);
        }
        timeout = Math.min(timeout, remaining);
    }
    return Math.floor(timeout);
}
export class CodingSession {
    sandbox;
    deniedRoots;
    _bind;
    _workspaces;
    _runs;
    _keys;
    _moved;
    constructor(sandbox, deniedRoots = []) {
        this.sandbox = sandbox;
        this.deniedRoots = deniedRoots;
        this._bind = `__qvac_dir="\${TMPDIR:-/tmp}"/qvac-coding-${b4a.toHex(randomBytes(8))}`;
        this._workspaces = new Map();
        this._runs = new Map();
        this._keys = new Map();
        this._moved = new Set();
    }
    effect(ctx, args) {
        const root = ctx?.fsWriteRoots?.[0];
        const line = args?.command;
        const fresh = !args?.cwd && !this._moved.has(ctx?.runId ?? '');
        if (typeof line === 'string' && fresh && root?.kind === 'local' && readsOnly(line, root.root)) {
            return 'read';
        }
        return ctx?.planMode || !this.sandbox.isolated ? 'write' : 'read';
    }
    refusal(ctx) {
        return ctx?.policy?.network.mode === 'off' && !this.sandbox.isolated
            ? guidance(NOT_ISOLATED)
            : null;
    }
    async workspace(ctx) {
        const root = this.refusal(ctx) ?? workspaceRoot(ctx);
        if (isError(root)) {
            return root;
        }
        const deny = await callDenyRoots(this.deniedRoots, ctx?.policy, defaultRealpath);
        return deny.some((each) => overlaps(root.root, each)) ? guidance(DENIED_WORKSPACE) : root;
    }
    policyVersion() {
        return JSON.stringify({
            sandbox: this.sandbox.name,
            isolated: this.sandbox.isolated,
            deniedRoots: [...this.deniedRoots].sort()
        });
    }
    statePath(runId) {
        return `${STATE_DIR}/${b4a.toHex(b4a.from(runId))}`;
    }
    open(root, runId, policy) {
        const key = `${root.root}\0${JSON.stringify(policy)}`;
        this._runs.set(runId, root.root);
        this._keys.set(runId, key);
        let workspace = this._workspaces.get(key);
        if (!workspace) {
            workspace = this.sandbox.open(root.root, policy);
            workspace.catch(() => this._workspaces.delete(key));
            this._workspaces.set(key, workspace);
        }
        return workspace;
    }
    workspaceOf(runId) {
        const key = this._keys.get(runId);
        return key === undefined ? null : (this._workspaces.get(key) ?? null);
    }
    _prelude(runId) {
        return [
            this._bind,
            `mkdir -p -m 700 ${STATE_DIR} ${STATE_DIR}/jobs`,
            `__qvac_state=${this.statePath(runId)}`,
            '[ -f "$__qvac_state.env" ] && . "$__qvac_state.env"',
            '[ -f "$__qvac_state.cwd" ] && cd "$(cat "$__qvac_state.cwd")"'
        ];
    }
    exec({ workspace, runId, line }, { timeoutMs, signal } = {}) {
        this._moves(runId, line);
        const script = [
            ...this._prelude(runId),
            '__qvac_save() {',
            '  __qvac_code=$?',
            '  export -p > "$__qvac_state.tmp" && mv "$__qvac_state.tmp" "$__qvac_state.env"',
            '  pwd > "$__qvac_state.cwd"',
            '  exit $__qvac_code',
            '}',
            'trap __qvac_save EXIT',
            `eval ${shellQuote(line)}`
        ].join('\n');
        return workspace.exec(script, { cwd: this._runs.get(runId), timeoutMs, signal });
    }
    _moves(runId, line) {
        if (!readsOnly(line)) {
            this._moved.add(runId);
        }
    }
    jobLog(id) {
        return `${STATE_DIR}/jobs/${id}.log`;
    }
    start({ workspace, runId, line }, id) {
        this._moves(runId, line);
        const job = shellQuote(`trap wait EXIT\n${line}`);
        const script = [...this._prelude(runId), `exec sh -c ${job} > ${this.jobLog(id)} 2>&1`];
        return workspace.start(script.join('\n'), { cwd: this._runs.get(runId) });
    }
    execState(workspace, line) {
        return workspace.exec(`${this._bind}\n${line}`);
    }
    async endRun(runId) {
        const workspace = this.workspaceOf(runId);
        this._runs.delete(runId);
        this._keys.delete(runId);
        this._moved.delete(runId);
        if (workspace) {
            const state = this.statePath(runId);
            await this.execState(await workspace, `rm -f ${state}.env ${state}.cwd ${state}.tmp`);
        }
    }
    async close() {
        const workspaces = await Promise.allSettled(this._workspaces.values());
        this._workspaces.clear();
        this._runs.clear();
        this._keys.clear();
        await Promise.allSettled(workspaces.map(async (each) => {
            if (each.status !== 'fulfilled')
                return;
            try {
                await this.execState(each.value, `rm -rf ${STATE_DIR}`);
            }
            finally {
                await each.value.close();
            }
        }));
    }
}
const SHELL_DESCRIPTION = 'Run a shell command in the project sandbox. The full sh line works: pipes, redirects, ' +
    '&&, scripts and test runners. The working directory and exported variables carry over ' +
    'to the next call in this run. The command has no stdin, so an interactive prompt waits ' +
    'until the timeout: pass flags such as -y instead. Set background to start a dev server ' +
    'or a watcher, then read it with shell_jobs.';
const SHELL_PARAMETERS = {
    type: 'object',
    properties: {
        command: { type: 'string', description: 'The sh command line' },
        cwd: {
            type: 'string',
            description: 'Directory to run in, inside the project; it carries over'
        },
        timeoutMs: { type: 'number', description: 'default 300000, max 1800000' },
        background: { type: 'boolean', description: 'Start it as a job and return its id at once' }
    },
    required: ['command']
};
async function shellLine(root, args) {
    const command = String(args.command ?? '');
    if (typeof args.cwd !== 'string' || !args.cwd) {
        return command;
    }
    const cwd = await workspacePath(root, args.cwd);
    return isError(cwd) ? cwd : `cd ${shellQuote(cwd)} && ${command}`;
}
async function runShell({ session, start }, args, ctx) {
    const root = await session.workspace(ctx);
    if (isError(root)) {
        return root;
    }
    const line = await shellLine(root, args);
    const timeoutMs = callTimeout(args.timeoutMs, ctx);
    if (isError(line)) {
        return line;
    }
    if (isError(timeoutMs)) {
        return timeoutMs;
    }
    const runId = ctx?.runId ?? '';
    try {
        const policy = ctx?.policy ?? Policy.compile(undefined, { write: [root.root] });
        const call = { workspace: await session.open(root, runId, policy), runId, line };
        if (args.background === true) {
            return await start(call);
        }
        return await cappedResult(await session.exec(call, { timeoutMs, signal: ctx?.signal }), ctx);
    }
    catch (error) {
        return { error: errorText(error) };
    }
}
export function shellTool(options) {
    const { session } = options;
    return {
        name: 'shell',
        toolset: 'coding',
        policyVersion: session.policyVersion(),
        description: SHELL_DESCRIPTION,
        parameters: SHELL_PARAMETERS,
        effect: (args, ctx) => session.effect(ctx, args),
        quote: (args) => (typeof args.command === 'string' ? args.command : null),
        command: (args) => (typeof args.command === 'string' ? args.command : null),
        validate(args) {
            return typeof args.command === 'string' && args.command.trim()
                ? null
                : 'command must be a non-empty string';
        },
        execute: (args, ctx) => runShell(options, args, ctx)
    };
}
