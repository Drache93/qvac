import type { Capabilities, CapabilityHandlers } from '../../spec/capabilities.d.ts';
import { type PeerStream } from './peer-duplex.ts';
export interface DeviceControlOptions {
    readonly allowed: (deviceId: Uint8Array) => Promise<boolean>;
    readonly served: () => Partial<CapabilityHandlers> | null;
}
export declare class DeviceControl {
    private readonly _opts;
    private readonly _channel;
    private readonly _engines;
    private readonly _ours;
    private readonly _checks;
    constructor(opts: DeviceControlOptions);
    addStream(stream: PeerStream): void;
    engine(deviceId: Uint8Array): Capabilities;
    revalidate(): Promise<void>;
    destroy(): void;
    private _accept;
    private _changed;
    private _recheck;
}
