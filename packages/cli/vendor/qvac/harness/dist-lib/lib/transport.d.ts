import { Duplex } from 'streamx';
export { settleOnClose, type Stream, type Transport } from './rpc-session.ts';
export interface Pipe {
    write(data: Buffer): unknown;
    on(event: 'data', listener: (chunk: unknown) => void): unknown;
}
export interface ClientSessions {
    readonly current: Duplex;
    reset(): Duplex;
}
export declare function clientSessions(pipe: Pipe): ClientSessions;
export declare function duplexPair(): [Duplex, Duplex];
