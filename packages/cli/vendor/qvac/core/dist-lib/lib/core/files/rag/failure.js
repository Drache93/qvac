import { INDEXING_FAILURES } from '../../../../schema/engine.js';
import { errorMessage, isRecord } from '../../../guards.js';
const ERROR_LIMIT = 300;
const PASSWORD = /no password given|incorrect password/i;
const OUT_OF_SPACE = /no space left on device/i;
const CONTENT_FAILURES = new Set([
    'empty',
    'no-text',
    'password-protected',
    'unsupported'
]);
export class IndexingFailure extends Error {
    reason;
    constructor(reason, message) {
        super(message);
        this.name = 'IndexingFailure';
        this.reason = reason;
    }
}
export function contentFailure(fileName, bytes, { supported }) {
    if (!supported) {
        return new IndexingFailure('unsupported', `${fileName} is not a supported Knowledge file.`);
    }
    if (bytes.length === 0) {
        return new IndexingFailure('empty', `${fileName} is empty`);
    }
    return null;
}
export function failureReason(err) {
    if (err instanceof IndexingFailure)
        return err.reason;
    const message = errorMessage(err);
    if ((isRecord(err) && err.code === 'ENOSPC') || OUT_OF_SPACE.test(message)) {
        return 'out-of-space';
    }
    return PASSWORD.test(message) ? 'password-protected' : 'failed';
}
export function failureDetail(err) {
    const detail = errorMessage(err);
    return detail.length > ERROR_LIMIT ? `${detail.slice(0, ERROR_LIMIT)}...` : detail;
}
export function failureError(err) {
    return `${failureReason(err)}: ${failureDetail(err)}`;
}
export function parseFailure(error) {
    if (!error) {
        return { reason: 'failed', detail: null };
    }
    const split = error.indexOf(': ');
    const reason = INDEXING_FAILURES.find((known) => known === error.slice(0, split));
    return reason && split > 0
        ? { reason, detail: error.slice(split + 2) }
        : { reason: 'failed', detail: error };
}
export function isContentFailure(row) {
    return (!row.chatId && row.status === 'failed' && CONTENT_FAILURES.has(parseFailure(row.error).reason));
}
