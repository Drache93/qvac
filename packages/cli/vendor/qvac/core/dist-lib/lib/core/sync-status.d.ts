import type { AssistantSyncStatus } from '../../spec/hyperschema/types.d.ts';
import type { Mesh } from './mesh.ts';
export interface SyncActivity {
    watch(listener: () => void): void;
    unwatch(listener: () => void): void;
    once(event: 'close', listener: () => void): unknown;
    off(event: 'close', listener: () => void): unknown;
    readonly closing: unknown;
    readonly closed: boolean;
    readonly hold: SyncHold;
    snapshot(): Promise<AssistantSyncStatus>;
}
export interface SyncHold {
    keep(busy: boolean): boolean;
}
export declare function createSyncActivity(mesh: Mesh): SyncActivity;
export declare function syncStatusSnapshot(mesh: Mesh): Promise<AssistantSyncStatus>;
