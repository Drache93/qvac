import { AbortedError } from '../../../helpers/race-abort.js';
import { Agent } from '../../../agent/index.js';
import { DIRECT_CALL_ID } from '../../tool-turns.js';
import { approvalGate, trustedSources } from './execution-plan.js';
import { detachJson } from '../../../helpers/detach-json.js';
import { ruleInputs } from '../tool-execution.js';
import { deniedWithoutApprover, gateRejection, policyActivity } from './rejection.js';
export const directSearch = async function directSearch({ input: deps, context }) {
    return {
        directTool: context.pendingSearch
            ? await startDirectSearch(deps, context, context.pendingSearch)
            : null
    };
};
export async function startDirectSearch(deps, context, query) {
    const { args, session } = deps;
    const webSearch = session.enabled.find((tool) => tool.name === Agent.WEB_SEARCH_TOOL_NAME);
    if (!webSearch) {
        return null;
    }
    const fold = await session.pipeline.runPreToolFold({
        runId: session.runId,
        callId: DIRECT_CALL_ID,
        toolName: webSearch.name,
        effect: webSearch.effect({ query }),
        resource: detachJson(webSearch.resource?.({ query }) ?? null),
        args: { query },
        agentId: context.agentId,
        egress: webSearch.egress,
        ...ruleInputs(webSearch, undefined),
        signal: args.signal
    });
    const searchArgs = fold.ok ? detachJson(fold.args) : { query };
    if (args.signal?.aborted) {
        throw new AbortedError();
    }
    const call = {
        id: DIRECT_CALL_ID,
        key: session.callKey(webSearch.name, searchArgs),
        name: webSearch.name,
        args: searchArgs,
        permission: fold.ok ? fold.permission : undefined
    };
    const effect = webSearch.effect(detachJson(searchArgs));
    const execution = {
        kind: 'direct',
        effect,
        origin: 'tool-result',
        webSearch: true
    };
    if (fold.ok) {
        const sources = trustedSources(deps, context);
        const gate = approvalGate({
            deps,
            context,
            call,
            tool: webSearch,
            effect,
            sources
        });
        const gated = { ...execution, gate };
        const resource = gate.call.resource ?? null;
        const rejection = { context, call, execution: gated, resource, source: 'tool-result' };
        return {
            call,
            execution: gated,
            hookRejection: null,
            resource,
            rejection: gateRejection(rejection) ?? deniedWithoutApprover(rejection)
        };
    }
    return {
        call,
        execution,
        hookRejection: fold.rejection,
        resource: null,
        rejection: {
            result: fold.rejection,
            activity: policyActivity({ call, effect, resource: null }),
            effect,
            source: 'tool-result'
        }
    };
}
