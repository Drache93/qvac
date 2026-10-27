import { Document } from './document.js';
export { Document } from './document.js';
export function open(bytes, opts) {
    return Document.open(bytes, opts);
}
export function create(opts) {
    return Document.create(opts);
}
