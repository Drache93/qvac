import { AbortedError } from '../../../helpers/race-abort.js';
import { HarnessLog } from '../../../log.js';
import { Agent } from '../../../agent/index.js';
import { planToolCall } from '../../tool-plan.js';
import { approvalGate, resolvedCall, toolContext, trustedSources } from './execution-plan.js';
import { detachJson } from '../../../helpers/detach-json.js';
import { unreadySkillMessage } from '../../skill-entry.js';
import { deniedWithoutApprover, gateRejection, policyActivity } from './rejection.js';
export const inspecting = async function inspecting({ input: deps, context }) {
    const snapshot = context.currentCall;
    if (!snapshot) {
        throw new Error('completion graph selected inspection without a current call');
    }
    return inspectCall(deps, context, snapshot);
};
export function inspectCall(deps, context, snapshot) {
    const { args, session } = deps;
    const resolved = resolvedCall(session, snapshot);
    if (args.signal?.aborted) {
        throw new AbortedError();
    }
    const activation = {
        ...session.activation,
        loadedSkills: new Set(context.activated)
    };
    const executeContext = toolContext({ deps, context, name: resolved.call.name });
    const plan = planToolCall(resolved, {
        activation,
        skillCatalog: args.skillCatalog ?? [],
        loadedThisTurn: session.loadedThisTurn,
        loadedFilesThisTurn: session.loadedFilesThisTurn,
        webSearches: context.webSearches,
        context: executeContext,
        shownSkills: session.inContextSkills
            .filter((skill) => Agent.skillIsActive(skill.name, session.activation))
            .map((skill) => skill.name)
    });
    if (plan.searchCapReached) {
        HarnessLog.info('tool capped', {
            tool: resolved.call.name,
            count: context.webSearches
        });
    }
    const unavailableSkill = plan.skillCall && (!plan.toolAvailable || !plan.skillActive);
    const answeredRead = resolved.tool?.stableRead === true &&
        plan.effect === 'read' &&
        context.answeredReads?.includes(snapshot.key) === true;
    if (answeredRead) {
        HarnessLog.info('repeat of a read that already answered; not run again', {
            tool: resolved.call.name
        });
    }
    const hasEarlierRejection = answeredRead ||
        plan.skillAlreadyLoaded ||
        Boolean(plan.skillStatus) ||
        unavailableSkill ||
        plan.searchCapReached ||
        Boolean(plan.hookRejection);
    let resource = null;
    if (!plan.skillAlreadyLoaded && !plan.searchCapReached && plan.toolAvailable) {
        if (plan.skillStatus || unavailableSkill || plan.hookRejection) {
            resource = detachJson(resolved.tool?.resource?.(detachJson(resolved.args), executeContext) ?? null);
        }
    }
    let execution = null;
    if (!hasEarlierRejection && resolved.tool) {
        const inspectedGate = approvalGate({
            deps,
            context,
            call: snapshot,
            tool: resolved.tool,
            effect: plan.effect ?? 'write',
            sources: trustedSources(deps, context)
        });
        const gate = plan.skillCall ? { ...inspectedGate, approver: false } : inspectedGate;
        resource = gate.facts.resource;
        execution = {
            kind: 'tool',
            effect: plan.effect ?? 'write',
            origin: plan.source,
            webSearch: resolved.call.name === Agent.WEB_SEARCH_TOOL_NAME,
            gate
        };
    }
    const rejection = inspectRejection({
        context,
        plan,
        execution,
        resource,
        call: snapshot,
        answeredRead,
        unknownTool: unknownToolError(session, resolved.call.name)
    });
    return {
        call: snapshot,
        toolAvailable: plan.toolAvailable,
        skillCall: plan.skillCall,
        skillAlreadyLoaded: plan.skillAlreadyLoaded,
        skillStatus: plan.skillStatus,
        skillActive: plan.skillActive,
        skillName: plan.skillName,
        alreadyLoadedLabel: plan.alreadyLoadedLabel,
        unavailableSkillMessage: plan.unavailableSkillMessage,
        searchCapReached: plan.searchCapReached,
        searchCapMessage: plan.searchCapMessage,
        hookRejection: plan.hookRejection,
        source: plan.source,
        effect: plan.effect,
        resource,
        execution,
        rejection
    };
}
function unknownToolError(session, name) {
    const searchable = session.sdkTools?.some((tool) => tool.name === name && tool.deferLoading);
    const [owner] = searchable
        ? (Agent.collectToolGrants(session.inContextSkills).grantedOwners.get(name) ?? [])
        : [];
    return owner
        ? `${name} needs the ${owner} skill. Load it first, then call ${name}.`
        : `unknown tool: ${name}`;
}
const SKILL_WRITE_DENIED = 'Skill loaders must be read-only; this operation was not run.';
const repeatedReadMessage = (name) => `The result of this exact ${name} call is already above. Answer from it now; ` +
    `do not call ${name} again with the same arguments.`;
function inspectRejection({ context, plan, execution, resource, call, answeredRead, unknownTool }) {
    const effect = plan.effect;
    const source = plan.source;
    const base = { activity: null, effect, source };
    if (plan.skillAlreadyLoaded) {
        const content = `${plan.alreadyLoadedLabel} is already loaded. Follow the instructions you were given and do not load it again.`;
        return {
            ...base,
            result: { name: plan.skillName, content },
            emitCall: false,
            emitResult: false
        };
    }
    if (plan.skillStatus) {
        const error = unreadySkillMessage(plan.skillName, plan.skillStatus);
        return { ...base, result: { error }, activity: policyActivity({ call, effect, resource }) };
    }
    if (plan.skillCall && (!plan.toolAvailable || !plan.skillActive)) {
        return {
            ...base,
            result: { error: plan.unavailableSkillMessage },
            activity: policyActivity({ call, effect, resource })
        };
    }
    if (answeredRead) {
        return {
            ...base,
            result: { content: repeatedReadMessage(call.name) },
            emitCall: false,
            emitResult: false,
            repeat: { kind: 'success' }
        };
    }
    if (plan.searchCapReached) {
        return {
            ...base,
            result: { content: plan.searchCapMessage },
            emitCall: false,
            emitResult: false,
            capped: true
        };
    }
    if (plan.hookRejection) {
        return {
            ...base,
            result: plan.hookRejection,
            activity: policyActivity({ call, effect, resource })
        };
    }
    if (!plan.toolAvailable) {
        return {
            ...base,
            result: { error: unknownTool },
            activity: policyActivity({ call, effect, resource: null })
        };
    }
    const gated = gateRejection({ context, call, execution, resource, source });
    if (gated) {
        return gated;
    }
    if (plan.skillCall && plan.effect === 'write') {
        return {
            ...base,
            result: { error: SKILL_WRITE_DENIED, guidance: true },
            outcome: { kind: 'guidance', message: SKILL_WRITE_DENIED }
        };
    }
    return deniedWithoutApprover({ context, call, execution, resource, source });
}
