"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Requests = void 0;
const errors_1 = require("./errors");
class Requests {
    core;
    options;
    active;
    config;
    abort;
    cancellation;
    constructor(core, options) {
        this.core = core;
        this.options = options;
        this.active = [];
        this.cancellation = undefined;
        this.config = { wait: !options.offline, activeRequests: this.active };
        this.abort = () => {
            const reason = options.signal?.reason;
            this.cancellation =
                reason instanceof Error
                    ? reason
                    : new errors_1.ReleaseError('ABORT_ERR', 'Release operation aborted', reason);
            core.constructor.destroyRequests(this.active, this.cancellation);
        };
        options.signal?.addEventListener('abort', this.abort, { once: true });
    }
    check() {
        if (this.options.signal?.aborted) {
            throw this.options.signal.reason ?? new errors_1.ReleaseError('ABORT_ERR', 'Release operation aborted');
        }
    }
    fail(cause) {
        if (cause === this.cancellation || (0, errors_1.hasCode)(cause, 'REQUEST_CANCELLED'))
            this.check();
        if (this.options.offline &&
            (0, errors_1.hasCode)(cause, 'BLOCK_NOT_AVAILABLE', 'ERR_BLOCK_NOT_AVAILABLE', 'SNAPSHOT_NOT_AVAILABLE')) {
            throw new errors_1.ReleaseError('ERR_RELEASE_NOT_CACHED', 'Pinned release is not fully cached', cause);
        }
        throw cause;
    }
    close() {
        this.options.signal?.removeEventListener('abort', this.abort);
        this.core.constructor.destroyRequests(this.active);
    }
}
exports.Requests = Requests;
