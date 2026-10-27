import { Policy } from '../policy/index.js';
export const DELEGATE_TOOL_NAME = 'delegate';
const LOCAL = 'local';
const MAX_EXTERNAL = 2;
const BRIEF = 'A subagent sees only its task and the summary, never this conversation, so put every fact ' +
    'it needs in them.';
const DESCRIPTION = `Hand narrow, independent read-only tasks to subagents and get each answer back. ${BRIEF}`;
const EXTERNAL_DESCRIPTION = `Hand narrow, independent tasks to subagents and get each answer back. ${BRIEF}`;
const OFFLINE = 'external delegate targets need network.mode on, since no host list reaches their processes; use local subagents';
const NO_WORKDIR = 'an external delegate target needs a local folder granted to the run, and it has none';
export function createDelegateTool(host, base, { slots = 1, targets = [], read = [], maxExternal = MAX_EXTERNAL } = {}) {
    const offline = Policy.narrow(base.agent?.policy, base.policy).network?.mode !== 'on';
    const offered = offline ? [] : targets;
    const roster = {
        targets: new Map(offered.map((target) => [target.name, target])),
        read: new Set(read)
    };
    const execute = async (args, ctx) => {
        const { results, runs } = await fanOut(host, base, { ...roster, slots, maxExternal, args, ctx });
        return runs.length ? { results, data: { runs } } : { results };
    };
    return offered.length ? externalTool(offered, roster, execute) : localTool(execute);
}
function localTool(execute) {
    return {
        name: DELEGATE_TOOL_NAME,
        toolset: null,
        description: DESCRIPTION,
        parameters: {
            type: 'object',
            properties: {
                tasks: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'One self-contained task per subagent'
                },
                summary: { type: 'string', description: 'What every subagent needs to know, briefly' }
            },
            required: ['tasks']
        },
        autoApprove: true,
        effect: () => 'read',
        validate: (args) => Array.isArray(args.tasks) &&
            args.tasks.length > 0 &&
            args.tasks.every((task) => typeof task === 'string')
            ? null
            : 'tasks must be a non-empty array of strings',
        execute
    };
}
function externalTool(offered, roster, execute) {
    return {
        name: DELEGATE_TOOL_NAME,
        toolset: null,
        description: `${EXTERNAL_DESCRIPTION} Targets:\n- ${LOCAL}: a subagent on this model\n${offered
            .map((target) => `- ${target.name}: ${target.description}`)
            .join('\n')}`,
        parameters: parameters(offered),
        policyVersion: JSON.stringify([
            offered.map((target) => [target.name, target.policyVersion ?? null]),
            [...roster.read].sort()
        ]),
        autoApprove: false,
        externalWrite: true,
        effect: (args, ctx) => external(args, roster).some(({ target }) => ctx?.planMode || !roster.read.has(target))
            ? 'write'
            : 'read',
        validate: (args, ctx) => validate(args, ctx, roster),
        quote: (args, ctx) => {
            const lines = external(args, roster).map(({ task, target }) => `${target} in ${workdir(ctx, access(target, roster)) ?? '?'}: ${task}`);
            return lines.length ? lines.join('\n') : null;
        },
        execute
    };
}
function parameters(targets) {
    return {
        type: 'object',
        properties: {
            tasks: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        task: { type: 'string', description: 'One self-contained task' },
                        target: {
                            type: 'string',
                            enum: [LOCAL, ...targets.map((target) => target.name)],
                            description: `Who runs it; absent, ${LOCAL}`
                        }
                    },
                    required: ['task']
                },
                description: 'One task per subagent'
            },
            summary: { type: 'string', description: 'What every subagent needs to know, briefly' }
        },
        required: ['tasks']
    };
}
function tasksOf(args) {
    const tasks = Array.isArray(args.tasks) ? args.tasks : [];
    return tasks.map((item) => typeof item === 'string'
        ? { task: item, target: LOCAL }
        : { task: String(Object(item).task), target: String(Object(item).target ?? LOCAL) });
}
function external(args, roster) {
    return tasksOf(args).filter(({ target }) => roster.targets.has(target));
}
function validate(args, ctx, roster) {
    const tasks = Array.isArray(args.tasks) ? args.tasks : [];
    const valid = (item) => typeof item === 'string' ||
        (typeof Object(item).task === 'string' &&
            (Object(item).target === undefined ||
                Object(item).target === LOCAL ||
                roster.targets.has(Object(item).target)));
    if (tasks.length === 0 || !tasks.every(valid)) {
        return `tasks must be a non-empty array, each a string or { task, target } with target one of ${[
            LOCAL,
            ...roster.targets.keys()
        ].join(', ')}`;
    }
    const outside = external(args, roster);
    if (outside.length && (ctx?.policy?.network.mode ?? 'on') !== 'on') {
        return OFFLINE;
    }
    return outside.some(({ target }) => !workdir(ctx, access(target, roster))) ? NO_WORKDIR : null;
}
function access(target, roster) {
    return roster.read.has(target) ? 'read' : 'write';
}
function workdir(ctx, mode) {
    const writable = (ctx?.fsWriteRoots ?? []).filter((root) => root.kind === 'local');
    if (mode === 'write') {
        return writable.length === 1 ? writable[0].root : null;
    }
    const readable = [...writable, ...(ctx?.fsRoots ?? []).filter((root) => root.kind === 'local')];
    return readable[0]?.root ?? null;
}
async function fanOut(host, base, { slots, maxExternal, args, ctx, ...roster }) {
    const tasks = tasksOf(args);
    const summary = typeof args.summary === 'string' ? args.summary : '';
    const fanned = { results: new Array(tasks.length), runs: [] };
    const local = tasks.flatMap(({ target }, index) => (roster.targets.has(target) ? [] : [index]));
    const outside = tasks.flatMap(({ target }, index) => {
        const found = roster.targets.get(target);
        return found ? [{ index, target: found }] : [];
    });
    await Promise.all([
        pool(local, slots, async (index) => {
            const { task } = tasks[index];
            fanned.results[index] = await subagent(host, task, child(base, ctx, { task, summary, index }));
        }),
        pool(outside, maxExternal, async ({ index, target }) => {
            const { task } = tasks[index];
            const { runId, parentRunId } = child(base, ctx, { task, summary, index });
            const mode = access(target.name, roster);
            const ran = await runTarget(target, ctx, {
                prompt: summary ? `${summary}\n\n${task}` : task,
                workdir: workdir(ctx, mode) ?? '',
                access: mode,
                runId,
                parentRunId,
                deadlineMs: ctx?.runBudget?.deadlineMs
            });
            const { status, text, usage, transcript } = ran;
            fanned.results[index] = { task, target: target.name, status, text, usage };
            fanned.runs.push({ index, target: target.name, runId, parentRunId, transcript });
        })
    ]);
    fanned.runs.sort((a, b) => a.index - b.index);
    return fanned;
}
async function pool(items, width, run) {
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            await run(items[next++]);
        }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(width, items.length)) }, worker));
}
async function runTarget(target, ctx, task) {
    const parent = ctx?.signal;
    if (parent?.aborted) {
        return { status: 'aborted', text: '', transcript: [] };
    }
    if (task.deadlineMs !== undefined && task.deadlineMs <= Date.now()) {
        return { status: 'budget', text: '', transcript: [] };
    }
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    const deadline = deadlineTimer(task.deadlineMs, controller);
    parent?.addEventListener('abort', onAbort);
    const settled = (result) => {
        if (deadline.passed) {
            return { ...result, status: 'budget' };
        }
        return parent?.aborted ? { ...result, status: 'aborted' } : result;
    };
    try {
        return settled(await target.run(task, controller.signal));
    }
    catch (error) {
        return settled({
            status: 'error',
            text: String(Reflect.get(Object(error), 'message') ?? error),
            transcript: []
        });
    }
    finally {
        deadline.clear();
        parent?.removeEventListener('abort', onAbort);
    }
}
function deadlineTimer(deadlineMs, controller) {
    const deadline = { passed: false, clear: () => { } };
    if (deadlineMs === undefined) {
        return deadline;
    }
    const timer = setTimeout(() => {
        deadline.passed = true;
        controller.abort();
    }, Math.max(0, deadlineMs - Date.now()));
    deadline.clear = () => clearTimeout(timer);
    return deadline;
}
function child(base, ctx, { task, summary, index }) {
    const parent = ctx?.runId ?? base.runId;
    const run = {
        ...base,
        runId: parent === undefined ? undefined : `${parent}/d-${ctx?.callId ?? 0}-${index}`,
        parentRunId: parent,
        signal: ctx?.signal ?? base.signal,
        cacheKey: base.cacheKey === undefined ? undefined : `${base.cacheKey}/d`,
        messages: [{ role: 'user', content: summary ? `${summary}\n\n${task}` : task }],
        tools: base.tools?.filter((tool) => tool.name !== DELEGATE_TOOL_NAME),
        agent: base.agent && { ...base.agent, handoffs: null }
    };
    delete run.resume;
    delete run.recovery;
    delete run.input;
    delete run.goal;
    return run;
}
async function subagent(host, task, request) {
    let text = '';
    let status = 'answered';
    for await (const event of host.completion(request)) {
        const { type } = event;
        if (type === 'content') {
            text += String(Object(event).text ?? '');
        }
        else if (type === 'error') {
            status = type;
            text = String(Object(event).message ?? '');
        }
        else if (type === 'paused' || type === 'aborted') {
            status = type;
        }
    }
    return { task, status, text };
}
