import type { AssistantNotificationList } from '../../spec/hyperschema/types.d.ts';
import type { openLocalStore } from './local/index.ts';
import type { Mesh } from './mesh.ts';
type LocalStore = Awaited<ReturnType<typeof openLocalStore>>;
export interface DeriveNotificationsOptions {
    readonly limit?: number;
    readonly deviceId?: Buffer | null;
}
export declare function deriveNotifications(mesh: Mesh, local: LocalStore, { limit: requestedLimit, deviceId }?: DeriveNotificationsOptions): Promise<AssistantNotificationList>;
export {};
