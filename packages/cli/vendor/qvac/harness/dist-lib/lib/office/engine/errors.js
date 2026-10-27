import { CODES } from './codes.js';
export class DocsError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = 'DocsError';
        this.code = code;
    }
    static get codes() {
        return CODES;
    }
}
