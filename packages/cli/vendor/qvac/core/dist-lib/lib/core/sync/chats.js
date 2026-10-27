export function syncChatTombstone(mesh, chat) {
    if (!chat.deletedAt)
        return;
    mesh.emit('chat-tombstone', chat.id, chat.deletedAt);
}
