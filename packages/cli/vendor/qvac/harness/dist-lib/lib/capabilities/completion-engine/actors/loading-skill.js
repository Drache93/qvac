import { AbortedError } from '../../../helpers/race-abort.js';
import { spliceFrom } from '../splice.js';
import { labelOf, skillEmojiFrom } from '../loop.js';
import { readyPreflightFromFacts, reportFailure } from '../tool-execution.js';
import { skillFileKey } from '../../tool-plan.js';
import { toolResultTurn } from '../../tool-turns.js';
import { skillLoadTurns } from '../../sdk-tool.js';
import { isRecord } from '../../../guards.js';
import { loadedSkills } from '../session.js';
import { trustedSources } from './execution-plan.js';
import { runToolCall } from './execute.js';
export async function loadSkill({ emit, input: deps, context }, plan) {
    const { args, session } = deps;
    const { call, args: callArgs } = plan.resolved;
    const skillName = plan.skillName;
    if (args.signal?.aborted) {
        throw new AbortedError();
    }
    const display = labelOf(call.name, callArgs, skillEmojiFrom(session.inContextSkills, skillName));
    emit({
        type: 'tool-call',
        name: call.name,
        args: callArgs,
        rawCall: plan.resolved.rawCall,
        effect: plan.effect,
        display
    });
    const denied = new Set(context.deniedKeys);
    const facts = context.execution?.gate?.facts;
    if (!facts) {
        throw new Error('selected skill load has no inspected policy facts');
    }
    const executed = await runToolCall(plan, {
        approve: undefined,
        signal: args.signal,
        denied,
        sources: trustedSources(deps, context),
        outbound: session.outbound,
        pipeline: session.pipeline,
        runId: session.runId,
        deniedMessage: context.policy.deniedMessage,
        callId: call.id,
        skipApprovals: session.policy.skipApprovals,
        preflight: readyPreflightFromFacts(facts),
        display
    });
    const { outcome, activity } = executed;
    const output = outcome.kind === 'success'
        ? executed.output
        : await reportFailure(session.pipeline, {
            runId: session.runId,
            callId: call.id,
            toolName: call.name,
            agentId: context.agentId,
            args: callArgs,
            executed: executed.executed,
            outcome,
            result: executed.output
        });
    session.runOutcomes.record(output, outcome);
    if (activity) {
        emit(activity);
    }
    emit({ type: 'tool-result', name: call.name, result: output });
    const turn = toolResultTurn(call.name, call.id, output);
    const history = [
        ...context.history,
        { role: 'tool', content: turn }
    ];
    session.skillIcon = skillEmojiFrom(session.inContextSkills, skillName) ?? session.skillIcon;
    if (hasContent(output)) {
        const loadedFile = isRecord(output) && typeof output.file === 'string' ? output.file : null;
        if (loadedFile !== null) {
            const files = session.loadedSkillFiles.get(skillName) ?? new Set();
            files.add(loadedFile);
            session.loadedSkillFiles.set(skillName, files);
        }
        const fileKey = skillFileKey(skillName, callArgs);
        if (fileKey === null || (executed.executed && loadedFile === null)) {
            session.loadedThisTurn.add(skillName);
        }
        else {
            session.loadedFilesThisTurn.add(fileKey);
        }
        session.reselectTools?.(new Set([...loadedSkills(context, session), skillName]));
        const skill = session.inContextSkills.find(({ name }) => name === skillName);
        const loads = skillLoadTurns(skill, {
            sent: session.sdkTools,
            enabled: session.enabled,
            history
        });
        return {
            history: spliceFrom(context.history, [...history, ...loads]),
            source: session.outbound.facts('skill', turn),
            activate: skillName
        };
    }
    return { history: spliceFrom(context.history, history) };
}
function hasContent(output) {
    return isRecord(output) && 'content' in output;
}
