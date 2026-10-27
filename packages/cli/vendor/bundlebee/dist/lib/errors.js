"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReleaseError = void 0;
exports.hasCode = hasCode;
class ReleaseError extends Error {
    code;
    constructor(code, message, cause) {
        super(message, { cause });
        this.code = code;
    }
}
exports.ReleaseError = ReleaseError;
function hasCode(error, ...codes) {
    return (error instanceof Error &&
        'code' in error &&
        typeof error.code === 'string' &&
        codes.includes(error.code));
}
