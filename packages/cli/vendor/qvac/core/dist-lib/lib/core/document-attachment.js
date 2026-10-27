import { isAudioAttachment } from './audio-attachment.js';
import { classifyRagDocument, RAG_DOCUMENT_KIND } from './files/rag/index.js';
import { IMAGE_MIMES } from './image/normalize.js';
import { isVideoAttachment } from './video/attachment.js';
export function isDocumentAttachment(ref) {
    if (IMAGE_MIMES.has(ref.mimeType.toLowerCase()))
        return false;
    if (isVideoAttachment(ref.fileName, ref.mimeType))
        return false;
    return !isAudioAttachment(ref.fileName, ref.mimeType);
}
export function isPdfAttachment(ref) {
    return (classifyRagDocument({ fileName: ref.fileName, mimeType: ref.mimeType }) ===
        RAG_DOCUMENT_KIND.pdf);
}
export function documentAttachmentLine(doc) {
    return `[Attached file "${doc.fileName}" (${doc.mimeType}) — attachmentId: ${doc.id}]`;
}
export const DOCUMENT_ATTACHMENT_ONLY_PROMPT = 'The user sent one or more documents without any accompanying text, and no excerpts of them are available. Say what each file is and ask what they would like done with it.';
export function documentUnreadReason({ knowledgeOn, failedFiles, attachedCount }) {
    if (!knowledgeOn)
        return 'knowledge-off';
    if ((failedFiles?.length ?? 0) >= attachedCount)
        return 'unreadable';
    return 'indexing';
}
export function documentUnreadNotice(reason, plural) {
    const they = plural ? 'they are' : 'it is';
    const why = {
        indexing: `${they} still being indexed`,
        'knowledge-off': `${they} not something that could be included whole, and Knowledge is off for this agent`,
        unreadable: `${they} not readable on this device`
    }[reason];
    return `[The attached document${plural ? 's' : ''} could not be read for this reply: ${why}.]`;
}
export function pdfPagesCutNotice({ fileName, lastPage, pageCount }) {
    return `[Only pages 1–${lastPage} of "${fileName}" (${pageCount} pages) were shown to you as images; pages ${lastPage + 1}–${pageCount} were not, and no tool can show them. If asked about a later page you have no excerpt for, tell the user only the first ${lastPage} pages could be read. Do not guess its content.]`;
}
export function pdfPagesSkippedNotice(fileName) {
    return `[No page of "${fileName}" was shown to you as an image: the files before it in this message used up the page images, and no tool can show them. If asked about it and you have no excerpt, tell the user it could not be read. Do not guess its content.]`;
}
export function annotateDocumentAttachments(messages) {
    for (const turn of messages.filter((message) => message.documents?.length)) {
        const block = (turn.documents ?? []).map(documentAttachmentLine).join('\n');
        const head = turn.content.trim() || DOCUMENT_ATTACHMENT_ONLY_PROMPT;
        turn.content = `${head}\n${block}`;
        delete turn.documents;
    }
}
