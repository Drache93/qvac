import { raceAbort } from '../../lib/helpers/race-abort.js';
import { LanguageServer } from './server.js';
export class ServerPool {
    _options;
    _entries = new Map();
    _closed = false;
    constructor(options) {
        this._options = options;
    }
    async use(at, work) {
        if (this._closed)
            throw new Error('the lsp plugin is closed');
        const { config, root, signal } = at;
        const key = `${config.language}\0${root}`;
        const entry = this._entries.get(key) ?? this._start(key, config, root);
        entry.busy++;
        if (entry.timer) {
            clearTimeout(entry.timer);
        }
        entry.timer = null;
        try {
            return await work(await this._started(entry, config, signal));
        }
        finally {
            if (--entry.busy === 0 && this._entries.get(key) === entry) {
                entry.timer = setTimeout(() => this._drop(key, entry), this._options.idleMs);
            }
        }
    }
    async close() {
        this._closed = true;
        const entries = [...this._entries.keys()];
        await Promise.all(entries.map((key) => this._drop(key, this._entries.get(key))));
    }
    _start(key, config, root) {
        const server = new LanguageServer(config, root, this._options.spawn);
        const ready = server.initialize();
        const entry = { server, ready, busy: 0, timer: null };
        this._entries.set(key, entry);
        ready.catch(() => server.stop());
        server.exited.then(() => this._forget(key, entry));
        return entry;
    }
    async _started(entry, config, signal) {
        let timer;
        const waited = new Promise((_resolve, reject) => {
            const ms = this._options.startWaitMs;
            const still = `the ${config.language} language server is still starting after ${ms} ms; try again shortly`;
            timer = setTimeout(() => reject(new Error(still)), ms);
        });
        try {
            await raceAbort(Promise.race([entry.ready, waited]), signal);
            return entry.server;
        }
        finally {
            clearTimeout(timer);
        }
    }
    _forget(key, entry) {
        if (this._entries.get(key) !== entry)
            return;
        if (entry.timer) {
            clearTimeout(entry.timer);
        }
        this._entries.delete(key);
    }
    async _drop(key, entry) {
        if (!entry)
            return;
        this._forget(key, entry);
        await entry.server.stop();
    }
}
