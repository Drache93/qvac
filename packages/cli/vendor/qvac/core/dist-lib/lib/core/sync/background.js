import { ACTIVE_CHATS, CHUNKS_BY_CHAT } from '../collections.js';
const CUT_SHORT = new Error('background sync cut short');
export class BackgroundSync {
    _host;
    _opts;
    _focus = null;
    _running = null;
    _again = false;
    _stopped = false;
    _paused = null;
    _unpause = noop;
    _wake = noop;
    _entries = 0;
    constructor(host, opts) {
        this._host = host;
        this._opts = opts;
    }
    focus(chatId) {
        this._focus = chatId;
    }
    run(focus) {
        if (focus) {
            this._focus = focus;
        }
        if (this._stopped) {
            return Promise.resolve(false);
        }
        if (this._running) {
            this._again = true;
            return this._running;
        }
        this._running = this._passes();
        return this._running;
    }
    pause() {
        this._paused ??= new Promise((resolve) => (this._unpause = resolve));
    }
    resume() {
        this._unpause();
        this._paused = null;
    }
    stop() {
        this._stopped = true;
        this._wake();
        this.resume();
    }
    async _passes() {
        let length;
        do {
            this._again = false;
            length = await this._pass();
        } while (this._again && !this._cut);
        this._running = null;
        if (length !== null) {
            const synced = { length };
            this._host.emit('background-synced', synced);
        }
        return length !== null;
    }
    async _pass() {
        const { logger, scope } = this._opts;
        const started = Date.now();
        const head = this._host.autobee.bee.head();
        this._entries = 0;
        logger?.info(scope, 'background sync started', {
            length: head?.length ?? 0,
            focus: this._focus !== null
        });
        let finished = false;
        try {
            if (head) {
                await this._walkChats();
                await this._walkTree(head);
            }
            finished = true;
        }
        catch (err) {
            if (err !== CUT_SHORT && !this._cut) {
                logger?.warn(scope, 'background sync failed', err);
            }
        }
        const ms = Date.now() - started;
        logger?.info(scope, 'background sync finished', {
            entries: this._entries,
            ms,
            cutShort: !finished
        });
        return finished ? (head?.length ?? 0) : null;
    }
    async _walkChats() {
        const snap = this._host.view.snapshot();
        try {
            const walked = new Set();
            if (this._focus) {
                await this._walkChat(snap, this._focus, walked);
            }
            const order = [];
            for await (const chat of snap.find(ACTIVE_CHATS, { reverse: true })) {
                order.push(chat.id);
                await this._step();
            }
            for (let chatId = this._next(order, walked); chatId; chatId = this._next(order, walked)) {
                await this._walkChat(snap, chatId, walked);
            }
        }
        finally {
            await snap.close();
        }
    }
    _next(order, walked) {
        if (this._focus && !walked.has(this._focus)) {
            return this._focus;
        }
        return order.find((chatId) => !walked.has(chatId)) ?? null;
    }
    async _walkChat(snap, chatId, walked) {
        walked.add(chatId);
        const range = { gte: { chatId }, lte: { chatId }, reverse: true };
        for await (const _chunk of snap.find(CHUNKS_BY_CHAT, range)) {
            await this._step();
        }
        this._opts.logger?.debug(this._opts.scope, 'background sync walked a chat', { chatId });
    }
    async _walkTree(head) {
        const bee = this._host.autobee.bee.checkout(head);
        try {
            for await (const _entry of bee.createReadStream()) {
                await this._step();
            }
        }
        finally {
            await bee.close();
        }
    }
    async _step() {
        if (++this._entries % this._opts.batch === 0) {
            await this._sleep(this._opts.pauseMs);
        }
        while (this._paused) {
            await this._paused;
        }
        if (this._cut) {
            throw CUT_SHORT;
        }
    }
    get _cut() {
        return this._stopped || !!this._host.closing;
    }
    _sleep(ms) {
        if (ms === 0 || this._stopped) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, ms);
            this._wake = () => {
                clearTimeout(timer);
                resolve();
            };
        });
    }
}
function noop() { }
