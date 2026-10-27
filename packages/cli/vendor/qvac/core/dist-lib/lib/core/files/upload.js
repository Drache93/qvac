import b4a from 'b4a';
import { addKnowledge, assertKnowledgeRoom, isKnowledgeRoutedAttachment, routeAttachmentToKnowledge, removeKnowledge, syncAttachmentChunk } from './records/index.js';
import { normalizeImageForModel, IMAGE_MIMES } from '../image/normalize.js';
import { detectImageMime, mapDeclaredToSniffed } from '../image/sniff.js';
import { isSupportedRagDocument } from './rag/index.js';
import { appendChunk, requireChatIn, updateChunk } from '../chunk.js';
import { UploadInput } from './upload-input.js';
import { CoreError } from '../../errors.js';
const MODEL_NATIVE_IMAGE_MIMES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/bmp'
]);
const noop = () => { };
export async function* uploadFile(mesh, frames, { kind, maxBytes, deviceId, inactivityMs }) {
    const input = new UploadInput(frames, { inactivityMs });
    const it = input.iterator;
    let uploadId;
    try {
        const first = await it.next();
        if (first.done) {
            return;
        }
        const { chatId, runId, fileName, mimeType, raw, sourceId } = first.value;
        const originDeviceId = kind === 'knowledge' ? deviceId : first.value.originDeviceId;
        if ((kind === 'attachment' && typeof chatId !== 'string') ||
            typeof fileName !== 'string' ||
            typeof mimeType !== 'string' ||
            !originDeviceId) {
            throw new CoreError('UPLOAD_FIRST_FRAME_INCOMPLETE', [kind]);
        }
        let limit = maxBytes;
        let tooLarge = () => new CoreError('UPLOAD_TOO_LARGE', [kind, maxBytes]);
        if (chatId) {
            await requireChatIn(mesh, chatId);
        }
        else if (mesh.role !== 'project') {
            throw new CoreError('KNOWLEDGE_BASE_NOT_A_PROJECT');
        }
        else {
            const room = await assertKnowledgeRoom(mesh, first.value.totalBytes ?? 0);
            if (room.bytes < maxBytes) {
                limit = room.bytes;
                tooLarge = () => new CoreError('KNOWLEDGE_CAP_REACHED', [room.capBytes]);
            }
        }
        const upload = await mesh.files.beginUpload(first.value);
        uploadId = upload.id;
        input.onData = (bytes) => mesh.files.uploadProgress(upload.id, bytes);
        input.onFailure = (error) => mesh.files.uploadFailed(upload.id, error);
        const source = capped(dataFrames(it, first.value.data), limit, tooLarge);
        let stream = source;
        let storedMime = mimeType;
        const declaredSniffed = mapDeclaredToSniffed(storedMime);
        if (kind === 'knowledge') {
            const { head, rest } = await peekHead(source, 4096);
            if (declaredSniffed !== null && detectImageMime(head) !== declaredSniffed) {
                throw new CoreError('UPLOAD_MIME_MISMATCH', ['uploadKnowledge', mimeType]);
            }
            if (!isSupportedRagDocument({ fileName, mimeType, bytes: head })) {
                throw new CoreError('KNOWLEDGE_TYPE_UNSUPPORTED', [fileName]);
            }
            stream = rest;
        }
        else if (declaredSniffed !== null) {
            const image = yield* imageUpload(source, {
                raw,
                declared: declaredSniffed,
                mimeType: storedMime
            });
            stream = image.stream;
            storedMime = image.mimeType;
        }
        let final = null;
        for await (const frame of mesh.files.write(stream, { inactivityMs })) {
            if ('blobId' in frame) {
                final = frame;
            }
            else {
                yield { bytesWritten: frame.bytesWritten };
            }
        }
        if (final === null) {
            throw new Error('blob write ended without its blobId frame');
        }
        const attachment = {
            id: upload.id,
            fileName,
            mimeType: storedMime,
            byteLength: final.byteLength,
            blobId: mesh.files.reference(final.blobId),
            createdAt: Date.now()
        };
        if (!chatId) {
            const knowledge = await knowledgeBaseRow(mesh, input, attachment);
            mesh.files.uploadComplete(upload.id);
            input.onFailure = null;
            yield { bytesWritten: final.bytesWritten, knowledge };
            return;
        }
        let chunkId;
        try {
            input.check();
            const preview = IMAGE_MIMES.has(storedMime.toLowerCase());
            const appended = await appendChunk(mesh, {
                id: preview ? upload.id : undefined,
                display: preview ? { preview: true } : undefined,
                chatId,
                runId,
                type: 'attachment',
                attachment,
                originDeviceId,
                sourceId
            });
            chunkId = appended.id;
        }
        catch (err) {
            await mesh.files.clear(attachment.blobId, attachment.id).catch(noop);
            throw err;
        }
        let knowledge;
        try {
            input.check();
            if (kind === 'knowledge' || (!runId && isKnowledgeRoutedAttachment(attachment))) {
                knowledge = await routeAttachmentToKnowledge(mesh, chatId, attachment);
            }
            input.check();
        }
        catch (error) {
            await removeKnowledge(mesh, { knowledgeId: upload.id, at: Date.now() }).catch(noop);
            const tombstone = await updateChunk(mesh, {
                id: chunkId,
                attachment: { ...attachment, deletedAt: Date.now() }
            }).catch(noop);
            if (tombstone) {
                await syncAttachmentChunk(mesh, tombstone).catch(noop);
            }
            throw error;
        }
        mesh.files.uploadComplete(upload.id);
        input.onFailure = null;
        yield {
            bytesWritten: final.bytesWritten,
            attachment,
            knowledge
        };
    }
    catch (error) {
        input.fail(error);
        throw error;
    }
    finally {
        input.close();
        if (uploadId) {
            mesh.files.uploadClosed(uploadId);
        }
    }
}
async function knowledgeBaseRow(mesh, input, attachment) {
    const { id, fileName, mimeType, byteLength, blobId } = attachment;
    try {
        input.check();
        await assertKnowledgeRoom(mesh, byteLength);
        const knowledge = await addKnowledge(mesh, { id, fileName, mimeType, byteLength, blobId });
        input.check();
        return knowledge;
    }
    catch (error) {
        await removeKnowledge(mesh, { knowledgeId: id, at: Date.now() }).catch(noop);
        await mesh.files.clear(blobId, id).catch(noop);
        throw error;
    }
}
async function* imageUpload(source, { raw, declared, mimeType }) {
    const { head, rest } = await peekHead(source, 12);
    const sniffed = detectImageMime(head);
    if (raw) {
        if (sniffed !== declared) {
            throw new CoreError('UPLOAD_MIME_MISMATCH', ['uploadAttachment', mimeType]);
        }
        return { stream: rest, mimeType };
    }
    if (sniffed === null) {
        throw new CoreError('IMAGE_INVALID', [mimeType]);
    }
    const original = yield* bufferedImage(rest);
    const bytes = await normalizeImageForModel(original);
    let storedMime;
    if (bytes !== original) {
        storedMime = 'image/jpeg';
    }
    else if (MODEL_NATIVE_IMAGE_MIMES.has(sniffed)) {
        storedMime = sniffed;
    }
    else {
        throw new CoreError('IMAGE_DECODE_FAILED', [sniffed]);
    }
    const stream = (async function* () {
        yield bytes;
    })();
    return { stream, mimeType: storedMime };
}
async function* bufferedImage(rest) {
    const pieces = [];
    let received = 0;
    for await (const piece of rest) {
        if (pieces.length > 0) {
            yield { bytesWritten: received };
        }
        pieces.push(piece);
        received += piece.length;
    }
    return b4a.concat(pieces);
}
export async function* capped(chunks, maxBytes, tooLarge) {
    let total = 0;
    for await (const chunk of chunks) {
        total += chunk.length;
        if (total > maxBytes) {
            throw tooLarge();
        }
        yield chunk;
    }
}
export async function* dataFrames(rest, firstData) {
    if (firstData) {
        yield firstData;
    }
    let next = await rest.next();
    while (!next.done) {
        if (next.value.data) {
            yield next.value.data;
        }
        next = await rest.next();
    }
}
export async function peekHead(it, n) {
    const iterator = it[Symbol.asyncIterator]();
    const pieces = [];
    let collected = 0;
    while (collected < n) {
        const next = await iterator.next();
        if (next.done) {
            break;
        }
        pieces.push(next.value);
        collected += next.value.length;
    }
    const head = b4a.concat(pieces).subarray(0, Math.min(collected, n));
    const rest = (async function* () {
        for (const piece of pieces) {
            yield piece;
        }
        let step = await iterator.next();
        while (!step.done) {
            yield step.value;
            step = await iterator.next();
        }
    })();
    return { head, rest };
}
