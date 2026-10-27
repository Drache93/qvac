import { trackActivity } from './activity.js';
import { CHAT_GROUPS } from '../collections.js';
export function registerChatGroupRoutes(router) {
    router.add('@qvac/put-chat-group', trackActivity(async ({ group }, { tx, log }) => {
        const existing = await tx.get(CHAT_GROUPS, { id: group.id });
        if (existing?.deletedAt && !group.deletedAt) {
            log?.debug('contract', 'put-chat-group dropped: tombstone is sticky', { id: group.id });
            return;
        }
        if (existing && !group.deletedAt && existing.updatedAt > group.updatedAt) {
            log?.debug('contract', 'put-chat-group dropped: stale updatedAt', { id: group.id });
            return;
        }
        await tx.insert(CHAT_GROUPS, group);
        log?.debug('contract', existing ? 'chat group updated' : 'chat group created', {
            id: group.id
        });
        return group;
    }));
}
