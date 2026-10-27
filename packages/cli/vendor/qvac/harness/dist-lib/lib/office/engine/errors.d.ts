import { CODES, type DocsErrorCode } from './codes.ts';
export declare class DocsError extends Error {
    code: DocsErrorCode;
    constructor(code: DocsErrorCode, message: string);
    static get codes(): typeof CODES;
}
