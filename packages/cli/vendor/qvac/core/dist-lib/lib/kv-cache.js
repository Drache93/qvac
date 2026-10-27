import { errorMessage } from './guards.js';
export async function clearKvCache(client) {
    const clear = client.clearKvCache?.bind(client);
    return deleteWhenSupported(client, clear);
}
export async function deleteChatKvCache(client, chatId) {
    const remove = client.deleteChatKvCache?.bind(client);
    return deleteWhenSupported(client, remove && (() => remove({ chatId })));
}
async function deleteWhenSupported(client, deletion) {
    if (!client.deviceInfo || !deletion) {
        return unsupported();
    }
    try {
        const info = await client.deviceInfo();
        if (info.supportsKvCacheDeletion !== true) {
            return unsupported();
        }
        const response = await deletion();
        if (response.status === 'success') {
            return { status: 'success' };
        }
        if (response.status === 'failure') {
            return { status: 'failure', error: response.error ?? 'Core KV cache deletion failed' };
        }
        return unsupported(response.error);
    }
    catch (error) {
        return {
            status: 'failure',
            error: errorMessage(error)
        };
    }
}
function unsupported(error) {
    return { status: 'unsupported', error: error ?? 'Core does not support KV cache deletion' };
}
