import { isPurged } from './chat.js';
import { ownRunRequest } from './chunks.js';
import { projectRules } from './projects.js';
import { capToolActivityArguments } from '../../../schema/qvac.js';
import { TOOL_ACTIVITY, TOOL_ACTIVITY_COUNTER } from '../collections.js';
export function registerToolActivityRoutes(router) {
    router.add('@qvac/append-tool-activity', async ({ activity }, context) => {
        const { tx, log } = context;
        const existing = await tx.get(TOOL_ACTIVITY, { id: activity.id });
        if (existing) {
            return;
        }
        if (activity.chatId && (await isPurged(tx, activity.chatId))) {
            log?.debug('contract', 'tool activity dropped: chat is purged', { id: activity.id });
            return;
        }
        if (activity.runId &&
            (await projectRules(tx)) &&
            !(await ownRunRequest(context, activity.chatId, activity.runId))) {
            log?.warn('contract', "tool activity dropped: a project's run is written by its owner", {
                id: activity.id
            });
            return;
        }
        const counter = await tx.get(TOOL_ACTIVITY_COUNTER, {
            agentId: activity.agentId
        });
        const seq = (counter?.count ?? 0) + 1;
        const capped = capToolActivityArguments(activity.arguments);
        await tx.insert(TOOL_ACTIVITY_COUNTER, {
            agentId: activity.agentId,
            count: seq
        });
        await tx.insert(TOOL_ACTIVITY, { ...activity, arguments: capped, seq });
        log?.debug('contract', 'tool activity recorded', {
            agentId: activity.agentId,
            toolName: activity.toolName,
            decision: activity.decision
        });
    });
}
