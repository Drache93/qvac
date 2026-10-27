import BlindPeering from 'blind-peering';
import Hyperdrive from 'hyperdrive';
import type Corestore from 'corestore';
import type Hyperswarm from 'hyperswarm';
export interface AcquiredDrive {
    readonly drive: Hyperdrive;
    readonly writable: boolean;
}
export interface DriveHost {
    acquire(key: string): Promise<AcquiredDrive>;
    close(): Promise<void>;
}
export interface PeeredDriveHost extends DriveHost {
    startBlindPeering(): Promise<void>;
}
export interface DriveHostOptions {
    readonly swarm: Hyperswarm;
    readonly blindPeerKeys: ReadonlyArray<Buffer>;
    readonly blindPeering: () => BlindPeering | null;
}
export declare function createFsDriveHost(store: Corestore, opts: DriveHostOptions): PeeredDriveHost;
