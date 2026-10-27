import { toolConfigsWithinBounds } from '../../../schema/qvac.js';
import { toolConfigsCarrySecret } from '../tool-configs.js';
import { trackActivity } from './activity.js';
import { AGENTS, TOOL_CONFIGS } from '../collections.js';
import { WORKSPACES_RULES, rulesVersion } from './mesh-rules.js';
export function registerToolConfigsRoutes(router) {
    router.add('@qvac/put-tool-configs', trackActivity(async ({ settings }, { tx, log }) => {
        if (!toolConfigsWithinBounds(settings.settings)) {
            log?.debug('contract', 'put-tool-configs dropped: settings exceed the wire cap', {
                agentId: settings.agentId,
                toolName: settings.toolName
            });
            return;
        }
        if (toolConfigsCarrySecret(settings.settings)) {
            log?.debug('contract', 'put-tool-configs dropped: settings carry a replicated secret', {
                agentId: settings.agentId,
                toolName: settings.toolName
            });
            return;
        }
        const existing = await tx.get(TOOL_CONFIGS, {
            agentId: settings.agentId,
            toolName: settings.toolName
        });
        if (existing && existing.updatedAt > settings.updatedAt) {
            log?.debug('contract', 'put-tool-configs dropped: stale updatedAt', {
                agentId: settings.agentId,
                toolName: settings.toolName
            });
            return;
        }
        if (!settings.deletedAt && (await rulesVersion(tx)) < WORKSPACES_RULES) {
            const agent = await tx.get(AGENTS, { id: settings.agentId });
            if (!agent || agent.deletedAt) {
                log?.debug('contract', 'put-tool-configs dropped: agent missing or deleted', {
                    agentId: settings.agentId,
                    toolName: settings.toolName
                });
                return;
            }
        }
        await tx.insert(TOOL_CONFIGS, settings);
        log?.debug('contract', existing ? 'tool configs updated' : 'tool configs created', {
            agentId: settings.agentId,
            toolName: settings.toolName
        });
        return settings;
    }));
}
