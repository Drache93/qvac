export const MAX_OUTPUT_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_OUTPUT_TOTAL_BYTES = 50 * 1024 * 1024;
export const RUN_OUTPUT_BUDGET_BYTES = 150 * 1024 * 1024;
export const MAX_OUTPUTS = 8;
export const MAX_INPUTS = 24;
export const MAX_INPUT_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_FILE_NAME_LENGTH = 255;
const MIME_TYPES = {
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf: 'application/pdf',
    png: 'image/png',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    csv: 'text/csv',
    json: 'application/json',
    txt: 'text/plain',
    md: 'text/markdown',
    zip: 'application/zip',
    mp4: 'video/mp4',
    webm: 'video/webm',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg'
};
const DENIED_EXTENSIONS = new Set([
    'pptm',
    'docm',
    'xlsm',
    'command',
    'sh',
    'py',
    'app',
    'dmg',
    'scpt',
    'jar'
]);
function extensionOf(name) {
    return name.slice(name.lastIndexOf('.') + 1).toLowerCase();
}
function isKnownExtension(extension) {
    return extension in MIME_TYPES || DENIED_EXTENSIONS.has(extension);
}
function matches(bytes, signature) {
    if (bytes.length < signature.length)
        return false;
    return signature.every((byte, index) => bytes[index] === byte);
}
function hasExpectedSignature(extension, bytes) {
    if (extension === 'pptx' || extension === 'docx' || extension === 'xlsx' || extension === 'zip') {
        return matches(bytes, [0x50, 0x4b, 0x03, 0x04]);
    }
    if (extension === 'mp4' || extension === 'm4a') {
        return matches(bytes.slice(4), [0x66, 0x74, 0x79, 0x70]);
    }
    if (extension === 'webm') {
        return matches(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
    }
    if (extension === 'mp3') {
        return (matches(bytes, [0x49, 0x44, 0x33]) || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0));
    }
    if (extension === 'pdf') {
        return matches(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    }
    if (extension === 'png') {
        return matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    }
    if (extension === 'jpeg' || extension === 'jpg') {
        return matches(bytes, [0xff, 0xd8, 0xff]);
    }
    if (extension === 'gif') {
        return (matches(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
            matches(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]));
    }
    if (extension === 'webp') {
        return (matches(bytes, [0x52, 0x49, 0x46, 0x46]) && matches(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]));
    }
    return !bytes.includes(0);
}
export function checkFileName(name) {
    if (!name)
        return 'file name must not be empty';
    if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(name)) {
        return 'file name must not contain control characters';
    }
    if (/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(name)) {
        return 'file name must not contain bidi characters';
    }
    if (/[\u200b-\u200d\u2060\ufeff]/.test(name)) {
        return 'file name must not contain invisible characters';
    }
    if (name.includes('/') || name.includes('\\')) {
        return 'file name must not contain path separators';
    }
    if (name.includes('..'))
        return 'file name must not contain double dots';
    if (name.startsWith('.')) {
        return 'file name must not start with a dot';
    }
    if (name.endsWith('.') || name.endsWith(' ')) {
        return 'file name must not end with a dot or space';
    }
    const segments = name.split('.');
    if (segments.slice(1, -1).some((segment) => isKnownExtension(segment.toLowerCase()))) {
        return 'file name must have at most one extension';
    }
    if (name.length > MAX_FILE_NAME_LENGTH) {
        return 'file name must be 255 characters or fewer';
    }
    return null;
}
const SUPERSEDED = { ppt: 'pptx', doc: 'docx', xls: 'xlsx' };
export function checkOutputName(name) {
    const nameError = checkFileName(name);
    if (nameError) {
        return nameError;
    }
    const extension = extensionOf(name);
    const mimeType = MIME_TYPES[extension];
    if (DENIED_EXTENSIONS.has(extension) || !mimeType) {
        const saw = extension && extension !== name.toLowerCase()
            ? `".${extension}" is not an allowed output type`
            : `"${name}" has no file extension`;
        const instead = SUPERSEDED[extension];
        const fix = instead ? ` — this runtime writes the current format, so name it ".${instead}"` : '';
        return `${saw}${fix}. Allowed: ${Object.keys(MIME_TYPES)
            .map((e) => `.${e}`)
            .join(', ')}`;
    }
    return null;
}
export function checkOutputBytes(name, bytes, runningTotal) {
    const nameError = checkOutputName(name);
    if (nameError) {
        return { error: nameError };
    }
    const extension = extensionOf(name);
    const mimeType = MIME_TYPES[extension];
    if (!hasExpectedSignature(extension, bytes)) {
        return { error: 'file bytes do not match file type' };
    }
    if (bytes.length > MAX_OUTPUT_FILE_BYTES) {
        return { error: 'file exceeds maximum output size' };
    }
    if (runningTotal + bytes.length > MAX_OUTPUT_TOTAL_BYTES) {
        return { error: 'outputs exceed maximum total size' };
    }
    return { mimeType };
}
