import { AbortController as BareAbortController } from 'bare-abort-controller';
export function installAbortControllerPolyfill() {
    if (typeof globalThis.AbortController === 'undefined') {
        Object.defineProperty(globalThis, 'AbortController', {
            value: BareAbortController,
            writable: true,
            configurable: true
        });
    }
}
