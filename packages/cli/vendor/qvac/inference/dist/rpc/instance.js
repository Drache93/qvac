import { createRpcServerManager } from './manager.js';
import { advertiseRpcServer } from './discovery.js';
import { waitForReady } from './network.js';
import { getRpcServerProvider } from './provider.js';
export const rpcServers = createRpcServerManager({
    async start(options) {
        return getRpcServerProvider().start({
            ...(options.host !== undefined && { host: options.host }),
            ...(options.port !== undefined && { port: options.port }),
            ...(options.device !== undefined && { device: options.device }),
            ...(options.cache !== undefined && { cache: options.cache }),
            ...(options.threads !== undefined && { threads: options.threads }),
            ...(options.expectRdma !== undefined && { expectRdma: options.expectRdma }),
            ...(options.allowNonLoopbackHost !== undefined && {
                allowNonLoopbackHost: options.allowNonLoopbackHost
            })
        });
    },
    ready: (server, ctx) => waitForReady(server.host, server.port, ctx.signal),
    advertise: advertiseRpcServer
});
