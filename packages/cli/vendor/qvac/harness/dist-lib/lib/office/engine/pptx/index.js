import { Presentation } from './presentation.js';
export { Presentation } from './presentation.js';
export function open(bytes, opts) {
    return Presentation.open(bytes, opts);
}
export function create(opts) {
    return Presentation.create(opts);
}
