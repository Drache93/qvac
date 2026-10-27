import type { Socket } from 'net';
import type { HarnessPlugin, PluginSetup } from '../../lib/plugins/index.ts';
import { type HostResolver } from '../../lib/tools/url-guard.ts';
import type { EgressProxyOptions, EgressProxyService, EgressProxySession } from '../../lib/contract/egress-proxy.ts';
export type Dial = (address: string, port: number) => Socket;
export interface EgressProxyPluginOptions {
    readonly resolveHost?: HostResolver;
    readonly dial?: Dial;
}
export declare class EgressProxy implements HarnessPlugin, EgressProxyService {
    readonly name = "egress-proxy";
    readonly api = 1;
    readonly provides: string[];
    readonly addons: {
        'bare-net': () => Promise<{
            constants: {
                type: {
                    TCP: 1;
                    IPC: 2;
                };
                state: {
                    UNREFED: number;
                    BINDING: number;
                    BOUND: number;
                };
            };
            errors: typeof import("bare-net").errors;
            isIP: typeof import("bare-tcp").isIP;
            isIPv4: typeof import("bare-tcp").isIPv4;
            isIPv6: typeof import("bare-tcp").isIPv6;
            Socket: typeof import("bare-net").NetSocket;
            Server: typeof import("bare-net").NetServer;
            createConnection(path: string, opts?: import("bare-net").NetOptions & import("bare-pipe").PipeConnectOptions, onconnect?: () => void): import("bare-net").NetSocket;
            createConnection(path: string, onconnect: () => void): import("bare-net").NetSocket;
            createConnection(port: number, host?: string, opts?: import("bare-net").NetOptions & import("bare-tcp").TCPSocketConnectOptions, onconnect?: () => void): import("bare-net").NetSocket;
            createConnection(port: number, host: string, onconnect: () => void): import("bare-net").NetSocket;
            createConnection(port: number, onconnect: () => void): import("bare-net").NetSocket;
            createConnection(opts: import("bare-net").NetOptions & import("bare-net").NetSocketConnectOptions, onconnect?: () => void): import("bare-net").NetSocket;
            connect: typeof import("bare-net").createConnection;
            createServer(opts?: import("bare-net").NetOptions, onconnection?: (socket: import("bare-net").NetSocket) => void): import("bare-net").NetServer;
            createServer(onconnection: (socket: import("bare-net").NetSocket) => void): import("bare-net").NetServer;
            default: typeof import("bare-net");
        }>;
    };
    private readonly _resolveHost;
    private readonly _dial;
    private readonly _sessions;
    constructor({ resolveHost, dial }?: EgressProxyPluginOptions);
    setup(): PluginSetup;
    open({ hosts, signal }: EgressProxyOptions): Promise<EgressProxySession>;
    private _serve;
    private _forward;
}
