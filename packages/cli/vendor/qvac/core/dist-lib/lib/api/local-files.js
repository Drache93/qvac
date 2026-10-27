import b4a from 'b4a';
const HEX = {
    keyOf: (meshId) => b4a.from(meshId, 'hex'),
    idOf: (meshKey) => b4a.toHex(meshKey)
};
export function createLocalFilesApi(files, alias = HEX) {
    return {
        listLocalFiles: async (request) => {
            const meshKey = request?.meshId ? alias.keyOf(request.meshId) : undefined;
            return { files: (await files.live(meshKey)).map((file) => toEngineFile(file, alias)) };
        }
    };
}
function toEngineFile(file, alias) {
    return {
        meshId: alias.idOf(file.meshKey),
        chatId: file.chatId,
        attachmentId: file.attachmentId,
        blobId: file.blobId,
        fileName: file.fileName,
        mimeType: file.mimeType,
        byteLength: file.byteLength,
        own: file.own,
        lastAccessed: file.lastAccessed,
        cleared: file.cleared
    };
}
