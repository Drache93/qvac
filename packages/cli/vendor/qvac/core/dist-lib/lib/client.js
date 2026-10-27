import ReadyResource from 'ready-resource';
import { reconnectingWatch } from './reconnecting-watch.js';
import { openLocalEngineSpec } from './spec-loader.js';
import { settleOnClose } from '@qvac/harness/rpc';
export class Client extends ReadyResource {
    _transport;
    _log;
    _spec;
    _handlers;
    _watches;
    _stream;
    constructor(transport, { logger = null, spec = openLocalEngineSpec, handlers } = {}) {
        super();
        this._transport = transport;
        this._log = logger;
        this._spec = spec;
        this._handlers = handlers;
        this._watches = new Set();
        this._stream = null;
    }
    async _open() {
        this._stream = await this._transport();
        const { bindApi, engineClient, HRPC } = await this._spec();
        const rpc = settleOnClose(new HRPC(this._stream));
        const declined = { storeIdentityPhrase: () => ({ ok: false }) };
        bindApi(rpc, { ...declined, ...this._handlers });
        const capabilities = engineClient(rpc);
        const modelDownloadsWatch = this._reconnecting(capabilities.modelDownloadsWatch, 'model-download');
        const modelCatalogWatch = this._reconnecting(capabilities.modelCatalogWatch, 'model-catalog');
        const modelsWatch = this._reconnecting(capabilities.modelsWatch, 'models');
        Object.assign(this, capabilities, { modelCatalogWatch, modelDownloadsWatch, modelsWatch });
        this._log?.info('lifecycle', 'client open');
    }
    _reconnecting(open, scope) {
        return (input) => {
            const watch = reconnectingWatch(() => open(input), (error) => this._log?.warn(scope, 'watch disconnected — reopening', error));
            this._watches.add(watch);
            watch.on('close', () => this._watches.delete(watch));
            return watch;
        };
    }
    async _close() {
        for (const watch of this._watches) {
            watch.destroy();
        }
        this._watches.clear();
        const stream = this._stream;
        if (stream && !stream.destroyed) {
            const closed = new Promise((resolve) => stream.on('close', resolve));
            stream.destroy();
            await closed;
        }
        this._log?.info('lifecycle', 'client closed');
    }
}
