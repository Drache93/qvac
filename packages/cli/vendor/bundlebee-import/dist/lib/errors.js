"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportError = void 0;
exports.cancelled = cancelled;
exports.unavailable = unavailable;
exports.importFailure = importFailure;
class ImportError extends Error {
    code;
    constructor(message, options) {
        super(message, { cause: options.cause });
        this.code = options.code;
    }
}
exports.ImportError = ImportError;
function cancelled(signal) {
    if (signal?.aborted) {
        throw new ImportError('Release operation was cancelled', {
            code: 'ERR_IMPORT_ABORTED',
            cause: signal.reason
        });
    }
}
function unavailable(error, signal) {
    if (signal.aborted && signal.reason instanceof Error && signal.reason.name === 'TimeoutError') {
        return error === signal.reason || requestAborted(error);
    }
    if (!(error instanceof Error) || !('code' in error))
        return false;
    return error.code === 'ERR_RELEASE_NOT_CACHED' || error.code === 'ERR_RELEASE_NOT_FOUND';
}
function importFailure(error, options) {
    if (requestAborted(error) && options.deadline?.aborted)
        error = options.deadline.reason;
    if (!(error instanceof Error))
        return error;
    if (options.deadline?.aborted &&
        error === options.deadline.reason &&
        error.name === 'TimeoutError') {
        return new ImportError('Release retrieval timed out', {
            code: 'ERR_IMPORT_TIMEOUT',
            cause: error
        });
    }
    if (options.signal?.aborted && (error === options.signal.reason || requestAborted(error))) {
        return new ImportError('Release operation was cancelled', {
            code: 'ERR_IMPORT_ABORTED',
            cause: error
        });
    }
    return error;
}
function requestAborted(error) {
    return error instanceof Error && 'code' in error && error.code === 'ABORT_ERR';
}
