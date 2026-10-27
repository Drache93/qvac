import { Workbook } from './workbook.js';
export { Workbook };
export function open(bytes, opts) {
    return Workbook.open(bytes, opts);
}
export function create(opts) {
    return Workbook.create(opts);
}
