import { liveDeviceForWriter, trackActivity } from './activity.js';
import { APPROVAL_RULES } from '../collections.js';
export function registerApprovalRuleRoutes(router) {
    router.add('@qvac/put-approval-rule', trackActivity(async ({ rule }, { tx, node, log }) => {
        const existing = await tx.get(APPROVAL_RULES, { id: rule.id });
        if (existing && existing.updatedAt > rule.updatedAt) {
            log?.debug('contract', 'put-approval-rule dropped: stale updatedAt', { id: rule.id });
            return;
        }
        const author = await liveDeviceForWriter(tx, node.key);
        const stored = { ...rule, memberId: author?.memberId };
        await tx.insert(APPROVAL_RULES, stored);
        log?.info('contract', 'approval rule set', { id: rule.id });
        return stored;
    }));
}
