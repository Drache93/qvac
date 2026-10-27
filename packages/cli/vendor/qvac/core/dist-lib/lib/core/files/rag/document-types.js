function extensionForName(fileName) {
    if (!fileName) {
        return null;
    }
    const index = fileName.lastIndexOf('.');
    return index >= 0 ? fileName.slice(index).toLowerCase() : null;
}
function normalizeMimeType(mimeType) {
    return mimeType?.split(';')[0]?.trim().toLowerCase() ?? '';
}
export const RAG_ACCEPT_EXTENSIONS = [
    '.pdf',
    '.txt',
    '.md',
    '.markdown',
    '.rtf',
    '.html',
    '.htm',
    '.xhtml',
    '.log',
    '.json',
    '.jsonl',
    '.csv',
    '.tsv',
    '.xml',
    '.yaml',
    '.yml'
];
const KNOWN_UNSUPPORTED_EXTENSIONS = new Set([
    '.7z',
    '.apk',
    '.avi',
    '.bin',
    '.bz2',
    '.dmg',
    '.doc',
    '.epub',
    '.exe',
    '.gz',
    '.iso',
    '.key',
    '.mkv',
    '.mov',
    '.numbers',
    '.odp',
    '.ods',
    '.odt',
    '.pages',
    '.ppt',
    '.rar',
    '.tar',
    '.tgz',
    '.xls',
    '.zip'
]);
const KNOWN_UNSUPPORTED_MIME_PREFIXES = [
    'video/',
    'application/zip',
    'application/x-tar',
    'application/gzip',
    'application/x-7z',
    'application/x-rar',
    'application/vnd.openxmlformats-officedocument',
    'application/vnd.ms-',
    'application/vnd.oasis.opendocument',
    'application/msword',
    'application/epub'
];
export const EXEC_ATTACHABLE_EXTENSIONS = ['.docx', '.xlsx', '.pptx'];
export const EXEC_ATTACHABLE_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
];
const EXEC_ATTACHABLE_EXTENSION_SET = new Set(EXEC_ATTACHABLE_EXTENSIONS);
const EXEC_ATTACHABLE_MIME_SET = new Set(EXEC_ATTACHABLE_MIME_TYPES);
export function isExecAttachableDocument(input) {
    const extension = extensionForName(input.fileName);
    if (extension && EXEC_ATTACHABLE_EXTENSION_SET.has(extension)) {
        return true;
    }
    return EXEC_ATTACHABLE_MIME_SET.has(normalizeMimeType(input.mimeType));
}
export function isKnownUnsupportedDocument(input) {
    if (isExecAttachableDocument(input)) {
        return false;
    }
    const extension = extensionForName(input.fileName);
    if (extension && KNOWN_UNSUPPORTED_EXTENSIONS.has(extension)) {
        return true;
    }
    const mimeType = normalizeMimeType(input.mimeType);
    return KNOWN_UNSUPPORTED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}
