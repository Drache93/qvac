import { unwrap } from 'asenion';
export function unquoteArg(value) {
    return unwrap(String(value ?? ''));
}
