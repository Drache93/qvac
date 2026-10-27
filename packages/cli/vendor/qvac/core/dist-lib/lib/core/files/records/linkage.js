export const REPLY_MESSAGE_PREFIX = 'reply-';
export function replyMessageId(runId) {
    return `${REPLY_MESSAGE_PREFIX}${runId}`;
}
export function groupAttachmentsByMessage(attachments, userMessages) {
    const groups = new Map();
    const push = (messageId, chunk) => {
        const list = groups.get(messageId);
        if (list) {
            list.push(chunk);
        }
        else {
            groups.set(messageId, [chunk]);
        }
    };
    let boundary = 0;
    for (const attachment of attachments) {
        if (attachment.runId) {
            push(replyMessageId(attachment.runId), attachment);
            continue;
        }
        while (boundary < userMessages.length && userMessages[boundary].seq <= attachment.seq) {
            boundary++;
        }
        if (boundary < userMessages.length) {
            push(userMessages[boundary].id, attachment);
        }
    }
    return groups;
}
