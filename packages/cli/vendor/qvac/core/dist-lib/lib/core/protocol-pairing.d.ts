import Protomux from 'protomux';
export interface PairedStream {
    readonly noiseStream: {
        userData: unknown;
    };
}
export interface ProtocolPairing {
    mux(stream: PairedStream, onopen: () => void): Protomux;
    destroy(): void;
}
export declare function createProtocolPairing(protocol: string): ProtocolPairing;
