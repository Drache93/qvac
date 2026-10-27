export function linkAttachment(mint, attachment) {
    if (!mint || attachment.deletedAt)
        return attachment;
    const url = mint(attachment);
    return url ? { ...attachment, url } : attachment;
}
