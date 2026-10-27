import type { LoggerInterface } from '@qvac/logging';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import type { openLocalStore } from '../core/local/index.ts';
import { type MeshPool } from './current-mesh.ts';
type LocalStore = Awaited<ReturnType<typeof openLocalStore>>;
type NotificationCapabilities = Pick<CapabilityHandlers, 'notificationsWatch' | 'ackNotification'>;
interface NotificationOptions {
    readonly deviceId?: Buffer | null;
    readonly log: LoggerInterface | null;
}
export declare function createNotificationsApi(pool: MeshPool, local: LocalStore, options: NotificationOptions): NotificationCapabilities;
export {};
