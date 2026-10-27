import { AbortController as BareAbortController } from 'bare-abort-controller';
const PROVIDER_REQUEST_TIMEOUT_MS = 30_000;
const AbortController = globalThis.AbortController ?? BareAbortController;
export async function providerRequest({ fetchImpl, url, init, timeoutMs = PROVIDER_REQUEST_TIMEOUT_MS, timeout, read }) {
    const controller = new AbortController();
    let timer;
    const expired = new Promise((_resolve, reject) => {
        timer = globalThis.setTimeout(() => {
            controller.abort();
            reject(timeout());
        }, timeoutMs);
    });
    try {
        return await Promise.race([
            fetchImpl(url, { ...init, signal: controller.signal }).then(read),
            expired
        ]);
    }
    finally {
        globalThis.clearTimeout(timer);
    }
}
