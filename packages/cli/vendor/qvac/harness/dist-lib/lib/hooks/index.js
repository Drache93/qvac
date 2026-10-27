import { HarnessLog } from '../log.js';
import { normalizeToolExecutionOutcome } from '../helpers/run-outcome.js';
import { runHooks } from './run.js';
import { ArgRepairHook } from './built-in/arg-repair.js';
import { EgressGuardHook } from './built-in/egress.js';
import { PolicyRulesHook } from './built-in/policy-rules.js';
import { SandboxHook } from './built-in/sandbox.js';
import { SkillCatalogGuardHook } from './built-in/skill-catalog.js';
const TOOL_PHASES = ['preToolCall', 'postToolCall', 'toolFailure'];
const patterns = new WeakMap();
function matches(hook, ctx) {
    const pattern = patterns.get(hook);
    return !pattern || !('toolName' in ctx) || pattern.test(ctx.toolName);
}
function snapshotHooks(hooks) {
    const phaseCounts = new Map();
    return Object.freeze(hooks.map((hook) => {
        const count = (phaseCounts.get(hook.phase) ?? 0) + 1;
        phaseCounts.set(hook.phase, count);
        const name = hook.name?.trim() || `${hook.phase}:${count}`;
        const { matcher, timeoutMs } = hook;
        if (matcher && !TOOL_PHASES.includes(hook.phase)) {
            throw new Error(`Hook ${name} sets a matcher, but ${hook.phase} has no tool to match`);
        }
        const snapshot = Object.freeze({
            phase: hook.phase,
            name,
            matcher,
            timeoutMs,
            run: hook.run.bind(hook)
        });
        if (matcher && matcher !== '*') {
            patterns.set(snapshot, new RegExp(`^(?:${matcher})$`));
        }
        return snapshot;
    }));
}
async function advise(hooks, payload) {
    const folded = await runHooks(hooks, payload, matches);
    if ('guidance' in folded) {
        HarnessLog.warn('run hook failed', { stage: payload.phase, error: folded.error });
        return undefined;
    }
    return folded;
}
export class HookPipeline {
    static ArgRepairHook = ArgRepairHook;
    static EgressGuardHook = EgressGuardHook;
    static PolicyRulesHook = PolicyRulesHook;
    static SandboxHook = SandboxHook;
    static SkillCatalogGuardHook = SkillCatalogGuardHook;
    static snapshot = snapshotHooks;
    static defaults() {
        return [
            new ArgRepairHook(),
            new EgressGuardHook(),
            new SandboxHook(),
            new SkillCatalogGuardHook()
        ];
    }
    hooks;
    constructor(hooks = []) {
        this.hooks = snapshotHooks(hooks);
    }
    withRules(rules) {
        return new HookPipeline([...this.hooks, new PolicyRulesHook(rules)]);
    }
    hasPhase(phase) {
        return this.hooks.some((hook) => hook.phase === phase);
    }
    async onRunLifecycle(payload) {
        await advise(this.hooks, payload);
    }
    async onRunStart(payload) {
        await advise(this.hooks, { phase: 'runStart', ...payload });
    }
    async onRunEnd(payload) {
        await advise(this.hooks, { phase: 'runEnd', ...payload });
    }
    async promptSubmit(payload) {
        const folded = await runHooks(this.hooks, { phase: 'promptSubmit', ...payload }, matches);
        if ('guidance' in folded) {
            HarnessLog.info('prompt rejected by hook', { mode: payload.mode, hook: folded.hook });
            return { ok: false, rejection: folded };
        }
        return folded.context === undefined ? { ok: true } : { ok: true, context: folded.context };
    }
    async toolFailure(payload) {
        const folded = await advise(this.hooks, { phase: 'toolFailure', ...payload });
        return folded?.context;
    }
    async stop(payload) {
        const folded = await advise(this.hooks, { phase: 'stop', ...payload });
        return folded?.continue;
    }
    async preFold(payload) {
        const folded = await advise(this.hooks, { phase: 'preFold', ...payload });
        return folded?.instructions;
    }
    async runPreToolFold(payload) {
        const folded = await runHooks(this.hooks, { phase: 'preToolCall', ...payload }, matches);
        if ('guidance' in folded) {
            HarnessLog.info('tool rejected: pre-hook refused the call', {
                tool: payload.toolName,
                hook: folded.hook,
                phase: folded.phase
            });
            return { ok: false, rejection: folded };
        }
        const { args } = folded.ctx;
        return folded.permission
            ? { ok: true, args, permission: folded.permission }
            : { ok: true, args };
    }
    async runPostToolFold(payload) {
        let result = payload.result;
        let outcome = payload.outcome;
        let context;
        if (payload.executed) {
            const folded = await runHooks(this.hooks, { phase: 'postToolCall', ...payload, result }, matches);
            if ('guidance' in folded) {
                result = folded;
                outcome = { kind: 'guidance', message: folded.error };
            }
            else {
                result = folded.ctx.result;
                context = folded.context;
            }
        }
        if (outcome !== undefined) {
            outcome = normalizeToolExecutionOutcome(result, outcome);
        }
        return context === undefined ? { result, outcome } : { result, outcome, context };
    }
}
