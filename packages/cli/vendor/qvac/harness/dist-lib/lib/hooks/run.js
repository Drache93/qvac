import { AbortController } from 'bare-abort-controller';
import { errorMessage, isRecord } from '../guards.js';
import { HookHalt } from '../helpers/engine-error.js';
import { HarnessLog } from '../log.js';
function cloneJson(value) {
    try {
        const text = JSON.stringify(value);
        return text === undefined ? value : JSON.parse(text);
    }
    catch {
        return value;
    }
}
function isPlainObject(value) {
    return isRecord(value) && !Array.isArray(value);
}
function cloneArgs(args) {
    const cloned = cloneJson(args);
    return isPlainObject(cloned) ? cloned : args;
}
function isMessage(value) {
    return isPlainObject(value) && typeof value.role === 'string' && typeof value.content === 'string';
}
function cloneMessages(messages) {
    const cloned = cloneJson(messages);
    return Array.isArray(cloned) ? cloned.filter(isMessage) : messages;
}
function freshContext(ctx) {
    if (ctx.phase === 'preToolCall') {
        return { ...ctx, args: cloneArgs(ctx.args) };
    }
    if (ctx.phase === 'postToolCall' || ctx.phase === 'toolFailure') {
        return { ...ctx, args: cloneArgs(ctx.args), result: cloneJson(ctx.result) };
    }
    if (ctx.phase === 'runStart' || ctx.phase === 'preFold') {
        return { ...ctx, messages: cloneMessages(ctx.messages) };
    }
    return { ...ctx };
}
function isRejection(value) {
    return 'error' in value;
}
function text(value, key) {
    const found = Reflect.get(value, key);
    return typeof found === 'string' && found.trim() ? found : undefined;
}
function rejection(error, hook, phase) {
    return { kind: 'hook-rejection', hook, phase, error, guidance: true };
}
function joined(prior, next) {
    if (next === undefined)
        return prior;
    return prior === undefined ? next : `${prior}\n${next}`;
}
function permissionOf(prior, next) {
    if (next === 'ask' || prior === 'ask')
        return 'ask';
    return next === 'allow' ? 'allow' : prior;
}
function merge(fold, returned) {
    const { ctx } = fold;
    const next = { ...fold };
    if (ctx.phase === 'preToolCall') {
        const args = Reflect.get(returned, 'args');
        if (isPlainObject(args)) {
            next.ctx = { ...ctx, args };
        }
        next.permission = permissionOf(fold.permission, Reflect.get(returned, 'permission'));
    }
    if (ctx.phase === 'postToolCall' && 'result' in returned) {
        next.ctx = { ...ctx, result: returned.result };
    }
    if (ctx.phase === 'postToolCall' || ctx.phase === 'toolFailure' || ctx.phase === 'promptSubmit') {
        next.context = joined(fold.context, text(returned, 'context'));
    }
    if (ctx.phase === 'stop') {
        next.continue = joined(fold.continue, text(returned, 'continue'));
    }
    if (ctx.phase === 'preFold') {
        next.instructions = joined(fold.instructions, text(returned, 'instructions'));
    }
    return next;
}
function rejectionOf(current, err, hook) {
    const message = errorMessage(err);
    HarnessLog.warn('hook failed', { stage: current.phase, hook, error: message });
    if (current.phase === 'postToolCall') {
        return rejection(`tool executed; output withheld: post-hook failed: ${message}. Do not retry this call.`, hook, current.phase);
    }
    return rejection(`hook failed in ${current.phase}: ${message}`, hook, current.phase);
}
const HALTS = [
    'runStart',
    'preToolCall',
    'postToolCall',
    'promptSubmit',
    'toolFailure',
    'stop',
    'preFold'
];
class HookTimeout extends Error {
    constructor(ms) {
        super(`timed out after ${ms}ms`);
        this.name = 'HookTimeout';
    }
}
async function settle(hook, ctx) {
    const { timeoutMs } = hook;
    if (timeoutMs === undefined) {
        return hook.run(ctx);
    }
    const controller = new AbortController();
    const options = { signal: controller.signal };
    let timer;
    const expired = new Promise((_resolve, reject) => {
        timer = setTimeout(() => {
            controller.abort(undefined);
            reject(new HookTimeout(timeoutMs));
        }, timeoutMs);
    });
    try {
        return await Promise.race([Promise.resolve().then(() => hook.run(ctx, options)), expired]);
    }
    finally {
        clearTimeout(timer);
    }
}
export async function runHooks(hooks, ctx, match) {
    let fold = { ctx };
    let phaseIndex = 0;
    for (const hook of hooks) {
        if (hook.phase !== ctx.phase)
            continue;
        phaseIndex++;
        if (!match(hook, fold.ctx)) {
            continue;
        }
        const hookId = hook.name?.trim() || `${ctx.phase}:${phaseIndex}`;
        let returned;
        try {
            returned = await settle(hook, freshContext(fold.ctx));
        }
        catch (err) {
            return rejectionOf(fold.ctx, err, hookId);
        }
        if (!returned || typeof returned !== 'object') {
            continue;
        }
        const halt = HALTS.includes(ctx.phase) ? text(returned, 'halt') : undefined;
        if (halt !== undefined) {
            HarnessLog.info('hook halted the run', { stage: ctx.phase, hook: hookId });
            throw new HookHalt(halt, hookId);
        }
        if (isRejection(returned)) {
            return rejection(String(returned.error), hookId, ctx.phase);
        }
        if (ctx.phase === 'preToolCall' && Reflect.get(returned, 'permission') === 'deny') {
            const reason = text(returned, 'reason') ?? `${hookId} denied this call`;
            return rejection(reason, hookId, ctx.phase);
        }
        fold = merge(fold, returned);
    }
    return fold;
}
