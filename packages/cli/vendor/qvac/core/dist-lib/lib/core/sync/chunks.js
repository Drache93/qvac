export function syncNotificationChunk(mesh, chunk) {
    if (chunk.type === 'run-status') {
        const state = chunk.runStatus?.state;
        if (state !== 'completed' && state !== 'failed') {
            return;
        }
    }
    else if (chunk.type !== 'approval-request' && chunk.type !== 'user-message') {
        return;
    }
    mesh.emit('notification', {
        chatId: chunk.chatId,
        chunkId: chunk.id,
        seq: chunk.seq,
        type: chunk.type
    });
}
