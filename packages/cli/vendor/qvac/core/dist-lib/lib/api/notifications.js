import { CoreError } from '../errors.js';
import { deriveNotifications } from '../core/notification.js';
import { requireMesh } from './current-mesh.js';
import { watchable } from './watchable.js';
export function createNotificationsApi(pool, local, options) {
    return {
        notificationsWatch: watchable(async (request) => notificationSource(await requireMesh(pool, request.meshId, { follow: true }), local), (request, source) => notificationSnapshot(source.mesh, local, {
            limit: request.limit,
            deviceId: options.deviceId
        }), { name: 'notificationsWatch', log: options.log }),
        ackNotification: async ({ chatId, seq, notificationId, meshId }) => {
            if (notificationId) {
                if ((chatId !== undefined && chatId !== null) || (seq ?? 0) !== 0) {
                    throw new CoreError('NOTIFICATION_ACK_AMBIGUOUS');
                }
                await local.ackModelNotification(notificationId);
            }
            else {
                if (!chatId || seq === undefined || seq === null) {
                    throw new CoreError('NOTIFICATION_CHAT_ACK_INCOMPLETE');
                }
                await requireMesh(pool, meshId);
                await local.ackChatNotify(chatId, seq);
            }
            return { ok: true };
        }
    };
}
function notificationSource(mesh, local) {
    return {
        mesh,
        watch(listener) {
            mesh.watch(listener);
            local.watch(listener);
        },
        unwatch(listener) {
            mesh.unwatch(listener);
            local.unwatch(listener);
        },
        once: (event, listener) => mesh.once(event, listener),
        off: (event, listener) => mesh.off(event, listener),
        get closing() {
            return mesh.closing;
        },
        get closed() {
            return mesh.closed;
        }
    };
}
async function notificationSnapshot(mesh, local, { limit: requestedLimit, deviceId }) {
    let chats = { notifications: [] };
    if (!mesh.closing && !mesh.closed) {
        try {
            chats = await deriveNotifications(mesh, local, {
                limit: Number.MAX_SAFE_INTEGER,
                deviceId
            });
        }
        catch (error) {
            if (!mesh.closing && !mesh.closed) {
                throw error;
            }
        }
    }
    const models = await local.getModelNotifications();
    if (mesh.closing || mesh.closed) {
        chats = { notifications: [] };
    }
    const notifications = [
        ...(chats.notifications ?? []),
        ...models.flatMap((row) => row.notificationId && row.completedAt && !row.acknowledged
            ? [
                {
                    kind: 'model-downloaded',
                    notificationId: row.notificationId,
                    modelName: row.name,
                    createdAt: row.completedAt
                }
            ]
            : [])
    ].sort((left, right) => right.createdAt - left.createdAt || (right.seq ?? 0) - (left.seq ?? 0));
    const limit = requestedLimit || 200;
    return {
        notifications: notifications.slice(0, limit),
        truncated: notifications.length > limit || undefined
    };
}
