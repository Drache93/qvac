import { Duplex } from 'streamx';
export interface PeerStream {
    readonly remotePublicKey: Uint8Array;
    readonly noiseStream: {
        userData: unknown;
    };
}
export interface PeerDuplexOptions {
    readonly protocol: string;
    readonly onaccept: (fromDeviceId: Uint8Array) => Promise<Duplex | null>;
    readonly unreachable: () => Error;
    readonly revoked: () => Error;
    readonly onchange?: (deviceId: string) => void;
}
export declare class PeerDuplexChannel {
    private readonly _opts;
    private readonly _peers;
    private _nextId;
    private readonly _pairing;
    constructor(opts: PeerDuplexOptions);
    addStream(stream: PeerStream): void;
    openIds(): string[];
    isOpen(deviceId: string): boolean;
    closeDialled(deviceId: string, reason: () => Error): void;
    dial(deviceId: string): Duplex;
    revalidate(allowed: (deviceId: Uint8Array) => Promise<boolean>): Promise<void>;
    destroy(): void;
    private _opened;
    private _attach;
    private _serve;
    private _deliver;
    private _end;
    private _drop;
}
