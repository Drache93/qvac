import { HarnessError } from '../errors.js';
import { errorMessage } from '../guards.js';
const MAX_OFFICE_BYTES = 20 * 1024 * 1024;
export function extractWith(bytes, { fileName, signal, extract }) {
    if (bytes.byteLength > MAX_OFFICE_BYTES) {
        throw new HarnessError('OFFICE_TOO_LARGE', [bytes.byteLength, MAX_OFFICE_BYTES]);
    }
    if (signal?.aborted) {
        throw new HarnessError('OFFICE_EXTRACTION_ABORTED', [fileName]);
    }
    try {
        return extract(bytes);
    }
    catch (err) {
        throw new HarnessError('OFFICE_EXTRACTION_FAILED', [fileName, errorMessage(err)]);
    }
}
export function cellText(value) {
    return value === null || value === undefined ? '' : String(value).replaceAll('\n', ' ');
}
