import { spliceFrom } from '../splice.js';
import { annotateCompletionHistoryLastUserTime, directToolHistory, withLastUserNote } from '../turns.js';
import { labelOf, skillEmojiFrom } from '../loop.js';
import { loadedSkills } from '../session.js';
import { PRELOAD_ID_PREFIX } from '../../tool-turns.js';
import { skillLoadTurns } from '../../sdk-tool.js';
import { Agent } from '../../../agent/index.js';
import { errorMessage, isRecord } from '../../../guards.js';
import { isFailureResultReference } from '../../../helpers/failure-result.js';
export const skillStep = {
    label: 'Skill loading',
    propose({ session }, { preload }) {
        if (!preload) {
            return null;
        }
        return {
            id: `${PRELOAD_ID_PREFIX}${preload.name}`,
            tool: Agent.SKILL_TOOL_NAME,
            args: { name: preload.name },
            done: session.loadedThisTurn.has(preload.name)
        };
    },
    display({ session }, step) {
        return labelOf(step.tool, step.args, skillEmojiFrom(session.inContextSkills, skillOf(step)));
    },
    settle({ deps, context, step, result, announce }) {
        const { session } = deps;
        const name = skillOf(step);
        announce();
        if (!hasContent(result)) {
            return {
                failure: fail({
                    deps,
                    context,
                    step,
                    error: errorFrom(result) ?? 'skill did not return content'
                })
            };
        }
        const content = String(result.content);
        session.loadedThisTurn.add(name);
        session.skillIcon = skillEmojiFrom(session.inContextSkills, name) ?? session.skillIcon;
        const typed = withSystem(annotateCompletionHistoryLastUserTime(context.history, new Date(session.startedAt)), session.preloadSystem?.(name));
        session.reselectTools?.(new Set([...loadedSkills(context, session), name]));
        const called = directToolHistory(typed, {
            tool: step.tool,
            id: step.id,
            args: step.args,
            output: result,
            nudge: context.policy.continuationNudge
        });
        const loaded = called.slice(0, -1);
        const skill = session.inContextSkills.find((entry) => entry.name === name);
        const loads = skillLoadTurns(skill, {
            sent: session.sdkTools,
            enabled: session.enabled,
            history: loaded
        });
        const history = [...loaded, ...loads, ...called.slice(-1)];
        return {
            history: spliceFrom(context.history, history),
            source: session.outbound.facts('skill', content),
            activate: name
        };
    },
    fail
};
function fail({ deps, context, step, error }) {
    const { history } = context;
    const message = `Skill "${skillOf(step)}" could not be loaded: ${error}`;
    const guided = withLastUserNote(history, message);
    const startedAt = new Date(deps.session.startedAt);
    return {
        error: message,
        history: spliceFrom(history, annotateCompletionHistoryLastUserTime(guided, startedAt))
    };
}
function withSystem(history, text) {
    const [first, ...rest] = history;
    return text !== undefined && first && !isFailureResultReference(first) && first.role === 'system'
        ? [{ ...first, content: text }, ...rest]
        : history;
}
function skillOf(step) {
    return step.id.slice(PRELOAD_ID_PREFIX.length);
}
function hasContent(value) {
    return isRecord(value) && 'content' in value;
}
function errorFrom(value) {
    if (isRecord(value) && 'error' in value) {
        return errorMessage(value.error);
    }
    return null;
}
