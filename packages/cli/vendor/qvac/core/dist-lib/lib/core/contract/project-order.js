import b4a from 'b4a';
import { MAX_PROJECT_ORDER_IDS } from '../../../schema/qvac.js';
import { PROJECT_ORDER } from '../collections.js';
import { trackActivity } from './activity.js';
async function putProjectOrder(order, { tx, log }) {
    const workspace = b4a.toHex(order.workspaceKey).slice(0, 8);
    if ((order.projectIds?.length ?? 0) > MAX_PROJECT_ORDER_IDS) {
        log?.warn('contract', 'put-project-order dropped: too many ids', { workspace });
        return;
    }
    const existing = await tx.get(PROJECT_ORDER, {
        workspaceKey: order.workspaceKey
    });
    if (existing && existing.orderedAt >= order.orderedAt) {
        log?.debug('contract', 'put-project-order dropped: not newer than the stored order', {
            workspace
        });
        return;
    }
    await tx.insert(PROJECT_ORDER, order);
    return order;
}
export function registerProjectOrderRoutes(router) {
    router.add('@qvac/put-project-order', trackActivity(putProjectOrder));
}
