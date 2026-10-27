"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Network = void 0;
const hyperswarm_1 = __importDefault(require("hyperswarm"));
const hyperdht_1 = __importDefault(require("hyperdht"));
const bare_abort_controller_1 = __importStar(require("bare-abort-controller"));
const hypercore_id_encoding_1 = require("hypercore-id-encoding");
const safety_catch_1 = __importDefault(require("safety-catch"));
const errors_1 = require("./errors");
class Network {
    store;
    bundle;
    options;
    controller;
    deadline;
    dht;
    swarm;
    connections;
    done;
    abort;
    expire;
    constructor(store, bundle, options) {
        this.store = store;
        this.bundle = bundle;
        this.options = options;
        this.controller = new bare_abort_controller_1.default();
        this.deadline = null;
        this.dht = null;
        this.swarm = null;
        this.connections = [];
        this.done = noop;
        this.abort = () => this.controller.abort(options.signal?.reason);
        this.expire = () => this.controller.abort(this.deadline?.reason);
    }
    get signal() {
        return this.controller.signal;
    }
    connectMirrors() {
        this.start();
        const borrowed = this.options.dht ?? this.options.swarm?.dht;
        const dht = borrowed ?? (this.dht = new hyperdht_1.default({ bootstrap: this.options.bootstrap }));
        // Separate identities prevent mirrors from replacing caller-owned connections.
        const keyPair = hyperdht_1.default.keyPair();
        const done = (this.done = this.bundle.core.findingPeers());
        for (const key of this.options.blindPeers ?? []) {
            const stream = dht.connect((0, hypercore_id_encoding_1.decode)(key), { keyPair });
            this.connections.push({
                stream,
                closed: new Promise((resolve) => stream.once('close', resolve))
            });
            // Unreachable mirrors are handled by retrieval; programmer errors remain fatal.
            stream.on('error', safety_catch_1.default);
            this.store.replicate(stream);
        }
        Promise.all(this.connections.map(({ stream }) => stream.opened)).then(done, (error) => {
            done();
            (0, safety_catch_1.default)(error);
        });
        return bare_abort_controller_1.AbortSignal.any([this.signal, bare_abort_controller_1.AbortSignal.timeout(this.options.blindTimeout ?? 2000)]);
    }
    async discover() {
        this.start();
        await this.closeMirrors();
        this.signal.throwIfAborted();
        const swarm = (this.swarm = new hyperswarm_1.default({ bootstrap: this.options.bootstrap }));
        const done = (this.done = this.bundle.core.findingPeers());
        swarm.on('connection', (stream) => this.store.replicate(stream));
        swarm.join(this.bundle.discoveryKey, { client: true, server: false });
        swarm.flush().then(done, (error) => {
            done();
            this.controller.abort(error);
            (0, safety_catch_1.default)(error);
        });
    }
    async close() {
        try {
            await this.closeMirrors();
        }
        finally {
            this.done();
            this.options.signal?.removeEventListener('abort', this.abort);
            this.deadline?.removeEventListener('abort', this.expire);
            await this.swarm?.destroy();
        }
    }
    start() {
        (0, errors_1.cancelled)(this.options.signal);
        if (this.deadline)
            return;
        this.options.signal?.addEventListener('abort', this.abort, { once: true });
        this.deadline = bare_abort_controller_1.AbortSignal.timeout(this.options.timeout ?? 10000);
        this.deadline.addEventListener('abort', this.expire, { once: true });
    }
    async closeMirrors() {
        this.done();
        for (const { stream } of this.connections)
            stream.destroy();
        await Promise.all(this.connections.map(({ closed }) => closed));
        await this.dht?.destroy();
        this.dht = null;
        this.connections = [];
    }
}
exports.Network = Network;
function noop() { }
