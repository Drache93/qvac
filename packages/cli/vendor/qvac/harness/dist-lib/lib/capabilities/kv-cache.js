import { errorMessage } from '../guards.js';
export async function deleteAllKvCaches(loadSdk) {
    return deleteCacheWith(loadSdk, { all: true });
}
export async function deleteKvCacheKey(loadSdk, kvCacheKey) {
    return deleteCacheWith(loadSdk, { kvCacheKey });
}
async function deleteCacheWith(loadSdk, params) {
    try {
        const sdk = await loadSdk();
        const result = await sdk.deleteCache(params);
        return result.success
            ? { status: 'success' }
            : { status: 'failure', error: 'SDK cache deletion did not succeed' };
    }
    catch (error) {
        return {
            status: 'failure',
            error: errorMessage(error)
        };
    }
}
export function unsupportedKvCacheDeletion(error) {
    return {
        status: 'unsupported',
        error: error ?? 'Harness does not support KV cache deletion'
    };
}
