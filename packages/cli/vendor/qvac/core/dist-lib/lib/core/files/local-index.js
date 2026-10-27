import b4a from 'b4a';
import { parseBlobReference } from './store/reference.js';
export function knownFile(chunk, owner) {
    const attachment = chunk.type === 'attachment' ? chunk.attachment : null;
    if (!attachment) {
        return null;
    }
    const file = referencedFile(attachment.blobId, owner);
    if (!file) {
        return null;
    }
    return {
        ...file,
        chatId: chunk.chatId,
        attachmentId: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        byteLength: attachment.byteLength,
        deletedAt: attachment.deletedAt || undefined
    };
}
export function referencedFile(reference, owner) {
    const key = fileKeyOf(reference, owner);
    if (!key) {
        return null;
    }
    return { ...key, blobId: reference, own: b4a.equals(key.coreKey, owner.ownCoreKey) };
}
export function fileKeyOf(reference, { meshKey, ownCoreKey }) {
    let parsed;
    try {
        parsed = parseBlobReference(reference);
    }
    catch {
        return null;
    }
    if (parsed.inline) {
        return null;
    }
    const coreKey = parsed.coreKey ? b4a.from(parsed.coreKey, 'hex') : ownCoreKey;
    return { meshKey, coreKey, blockOffset: parsed.blobId.blockOffset };
}
