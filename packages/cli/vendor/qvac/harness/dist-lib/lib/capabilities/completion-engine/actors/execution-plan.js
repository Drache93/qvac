import { Agent } from '../../../agent/index.js';
import { labelOf } from '../loop.js';
import { detachJson } from '../../../helpers/detach-json.js';
import { inspectToolPolicy } from '../tool-execution.js';
import { modelTurns, trustedSourcesFrom } from '../turns.js';
import { skillNameOf } from '../../tool-plan.js';
import { runSpill } from '../../../spill.js';
export function resolvedCall(session, call) {
    const tool = session.enabled.find((tool) => tool.name === call.name);
    return {
        key: call.key,
        call: { id: call.id, name: call.name, arguments: call.args },
        args: call.args,
        tool,
        rawCall: call.rawCall,
        intent: call.intent,
        rejection: call.rejection
    };
}
export function toolContext({ deps, context, name }) {
    const { args, session, commitFacts } = deps;
    return {
        ...session.toolContext(session.turnImages, context.metrics.ctxSize ?? args.ctxSize, args.signal),
        skills: context.activated.filter((skill) => Agent.skillIsActive(skill, session.activation)),
        skillsLoadedThisTurn: [...session.loadedThisTurn],
        settings: args.toolConfigs?.[name],
        toolOps: session.grantedOps,
        fsRoots: args.fsRoots ?? [],
        fsWriteRoots: session.writableRoots,
        policy: session.access,
        toolNames: session.enabled.map((tool) => tool.name),
        knowledge: args.knowledge,
        planMode: context.planMode,
        spill: session.enabled.some((tool) => tool.name === 'read_file')
            ? runSpill(session.runId)
            : undefined,
        reportBackend: (use) => {
            session.backends.push(use);
            commitFacts?.();
        }
    };
}
export function executionPlan(deps, context, { call, execution }) {
    const resolved = resolvedCall(deps.session, call);
    if (!resolved.tool) {
        throw new Error(`tool implementation not found: ${resolved.call.name}`);
    }
    const resolvedWithTool = { ...resolved, tool: resolved.tool };
    return {
        type: 'execute',
        route: execution.origin === 'skill' ? 'skill' : 'tool',
        resolved: resolvedWithTool,
        context: toolContext({ deps, context, name: resolved.call.name }),
        effect: execution.effect,
        skillName: execution.origin === 'skill' ? skillNameOf(resolved.args) : null,
        webSearch: execution.webSearch
    };
}
const requestSources = new WeakMap();
export function trustedSources({ args }, context) {
    let sources = requestSources.get(args.messages);
    if (!sources) {
        sources = trustedSourcesFrom(modelTurns(args.messages, context.policy.continuationNudge));
        requestSources.set(args.messages, sources);
    }
    return { sources, sourceFacts: context.sources };
}
export function approvalGate({ deps, context, call, tool, effect, sources }) {
    const { args, session } = deps;
    const ctx = toolContext({ deps, context, name: call.name });
    const facts = inspectToolPolicy(tool, call.args, ctx, {
        sources: sources.sources,
        sourceFacts: sources.sourceFacts,
        outbound: session.outbound,
        denied: new Set(context.deniedKeys),
        effect,
        key: call.key,
        skipApprovals: session.policy.skipApprovals,
        permission: call.permission
    });
    return {
        facts,
        approver: Boolean(args.approve),
        call: {
            name: call.name,
            arguments: call.args,
            resource: facts.resource,
            effect: facts.effect,
            intent: call.intent ?? null,
            display: labelOf(call.name, call.args, session.skillIcon),
            quote: tool.quote?.(detachJson(call.args), ctx)
        }
    };
}
