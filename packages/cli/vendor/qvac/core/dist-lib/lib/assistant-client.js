import { Client } from './client.js';
import { duplexPair } from '@qvac/harness/transport';
import b4a from 'b4a';
import { CoreError } from './errors.js';
export class AssistantClient extends Client {
    _inline;
    constructor({ sidecar: spawnSidecar = true, storagePath, device, meshSeed, meshKey, bootstrapNodes, entry, ...engineOptions }) {
        const inline = { core: null };
        if (spawnSidecar && !entry) {
            throw new CoreError('SIDECAR_ENTRY_MISSING');
        }
        const sidecarEntry = spawnSidecar ? entry : undefined;
        const args = [
            storagePath,
            device?.name ?? '',
            device?.capabilityProfile ?? '',
            device?.recommendedModelName ?? '',
            meshSeed ? b4a.toHex(meshSeed) : '',
            meshKey ? b4a.toHex(meshKey) : '',
            (bootstrapNodes ?? []).map((node) => `${node.host}:${node.port}`).join(',')
        ];
        const transport = sidecarEntry
            ? async () => {
                const { default: sidecarRunner } = await import('bare-supervisor/runner/sidecar');
                const { ipc, exit } = sidecarRunner(sidecarEntry, args, engineOptions.logger ?? null);
                const died = exit.then((code) => new CoreError('SIDECAR_EXITED', [code]));
                const failure = await Promise.race([ipc.ready.then(() => null), died]);
                if (failure) {
                    throw failure;
                }
                return ipc;
            }
            : async () => {
                const [serverStream, clientStream] = duplexPair();
                const { Core } = await import('./core.js');
                inline.core = new Core(() => serverStream, {
                    logger: engineOptions.logger ?? null,
                    storagePath,
                    device,
                    meshSeed,
                    meshKey,
                    bootstrapNodes
                });
                await inline.core.ready();
                return clientStream;
            };
        super(transport, engineOptions);
        this._inline = inline;
    }
    get core() {
        return this._inline.core;
    }
    async _close() {
        await super._close();
        await this._inline.core?.close();
    }
}
