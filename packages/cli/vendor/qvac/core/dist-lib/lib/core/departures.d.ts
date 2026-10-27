import type Corestore from 'corestore';
import type Hyperswarm from 'hyperswarm';
import type Wakeup from 'protomux-wakeup';
import type { LoggerInterface } from '@qvac/logging';
import type { LocalMeshDeparture } from '../../spec/local/hyperschema/types.d.ts';
import type BlindPeering from 'blind-peering';
import { Mesh } from './mesh.ts';
import type { MeshRole } from './contract/roles.ts';
interface DepartureRows {
    departures(): Promise<LocalMeshDeparture[]>;
    departureRole(departure: LocalMeshDeparture): Promise<MeshRole>;
    deleteDeparture(key: Buffer): Promise<void>;
}
export interface PendingDeparturesOptions {
    swarm: Hyperswarm;
    isPooled: (key: Buffer) => boolean;
    deviceId: () => Buffer | null;
    logger?: LoggerInterface | null;
    blindPeerKeys?: ReadonlyArray<Buffer>;
    blindPeering: () => BlindPeering | null;
    wakeup?: Wakeup;
    delivered?: (key: Buffer) => void;
}
export declare class PendingDepartures {
    private readonly _store;
    private readonly _local;
    private readonly _swarm;
    private readonly _log;
    private readonly _blindPeerKeys;
    private readonly _wakeup;
    private readonly _isPooled;
    private readonly _deviceId;
    private readonly _delivered;
    private readonly _active;
    private readonly _parked;
    private readonly _lock;
    private _closing;
    private readonly _blindPeering;
    constructor(store: Corestore, local: DepartureRows, opts: PendingDeparturesOptions);
    flush(): void;
    private _flush;
    private _deliver;
    private _announce;
    park(key: Buffer): Promise<void>;
    unpark(key: Buffer): void;
    drop(key: Buffer): Promise<void>;
    startBlindPeering(): void;
    stopBlindPeering(): void;
    suspend(): Promise<void>;
    resume(): Promise<void>;
    close(): Promise<void>;
}
export declare function waitForDelivery(mesh: Mesh): Promise<boolean>;
export {};
