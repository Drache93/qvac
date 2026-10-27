import fs from 'fs';
import path from 'path';
import { HarnessError } from '../../errors.js';
import { errorMessage } from '../../guards.js';
import { HarnessLog } from '../../log.js';
import { checkOutputBytes, MAX_INPUT_TOTAL_BYTES, RUN_OUTPUT_BUDGET_BYTES } from './output-policy.js';
const STAGE_TIMEOUT_MS = 60_000;
const OVER_BUDGET_ERROR = 'inputs exceed maximum total size';
const NO_UPLOAD_ERROR = 'no uploaded image in this chat — attach an image or pass an attachmentId';
const DOCUMENT_INPUT = /\.(pdf|docx?|xlsx?|xlsm|pptx?|csv|tsv|txt|md|markdown|rtf|odt|ods|odp|epub|jsonl?|xhtml|html?|xml|ya?ml|log|zip)$/i;
const NO_DOCUMENT_ERROR = 'an id-less input stages an uploaded image, and this path names a document — pass its ' +
    'attachmentId, which the [Attached file "…"] line on the user\'s message carries';
function bounded(work, ms) {
    let timer;
    const bound = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new HarnessError('ATTACHMENT_STAGING_TIMED_OUT', [STAGE_TIMEOUT_MS])), ms);
    });
    return Promise.race([work, bound]).finally(() => {
        if (timer) {
            clearTimeout(timer);
        }
    });
}
function hasBytes(record) {
    return 'bytes' in record && record.bytes !== null;
}
function byteLengthOf(record) {
    return hasBytes(record) ? record.bytes.byteLength : record.byteLength;
}
async function uploadedBytes(fetchAttachment, index, { turnImages, signal }) {
    const image = turnImages[index];
    if (image) {
        const bytes = await fs.promises.readFile(image.path).catch(toNull);
        if (!bytes) {
            return { error: `could not read attached image ${path.basename(image.path)}` };
        }
        return bytes;
    }
    if (turnImages.length) {
        return {
            error: `the user's latest message has only ${turnImages.length} image(s) — one id-less input per uploaded image`
        };
    }
    if (index > 0) {
        return { error: NO_UPLOAD_ERROR };
    }
    const latest = await fetchAttachment({ signal });
    if (!latest || !hasBytes(latest)) {
        return { error: NO_UPLOAD_ERROR };
    }
    return latest.bytes;
}
async function probeUpload(fetchAttachment, input, { index, turnImages, signal, deadline }) {
    if (DOCUMENT_INPUT.test(input.path)) {
        return { error: NO_DOCUMENT_ERROR };
    }
    const bytes = await bounded(uploadedBytes(fetchAttachment, index, { turnImages, signal }), deadline - Date.now());
    if ('error' in bytes) {
        return bytes;
    }
    return { size: bytes.byteLength, bytes };
}
async function probeAttachment(fetchAttachment, id, { signal, deadline }) {
    const head = await bounded(fetchAttachment({ attachmentId: id, meta: true, signal }), deadline - Date.now());
    if (!head) {
        return { error: `attachment ${id} not found in this chat` };
    }
    return { size: byteLengthOf(head), bytes: hasBytes(head) ? head.bytes : null };
}
export async function stageInputs(fetchAttachment, inputs, opts = {}) {
    const { turnImages = [], signal } = opts;
    const files = inputs.map(() => null);
    const pending = [];
    const deadline = Date.now() + STAGE_TIMEOUT_MS;
    let total = 0;
    let uploads = 0;
    for (const [i, input] of inputs.entries()) {
        const id = input.attachmentId;
        try {
            const probe = id === undefined
                ? await probeUpload(fetchAttachment, input, {
                    index: uploads++,
                    turnImages,
                    signal,
                    deadline
                })
                : await probeAttachment(fetchAttachment, id, { signal, deadline });
            if ('error' in probe) {
                return probe;
            }
            total += probe.size;
            if (total > MAX_INPUT_TOTAL_BYTES) {
                HarnessLog.warn('input attachments over budget; skipping blob download', {
                    total,
                    cap: MAX_INPUT_TOTAL_BYTES,
                    count: inputs.length
                });
                return { error: OVER_BUDGET_ERROR };
            }
            if (probe.bytes !== null) {
                files[i] = { path: input.path, bytes: probe.bytes };
            }
            else {
                pending.push({ index: i, input });
            }
        }
        catch (error) {
            return { error: errorMessage(error) };
        }
    }
    for (const { index, input } of pending) {
        const id = input.attachmentId;
        try {
            const fetched = await bounded(fetchAttachment({ attachmentId: id, signal }), deadline - Date.now());
            if (!fetched || !hasBytes(fetched)) {
                return { error: `attachment ${id} not found in this chat` };
            }
            files[index] = { path: input.path, bytes: fetched.bytes };
        }
        catch (error) {
            return { error: errorMessage(error) };
        }
    }
    return { files: files.filter((file) => file !== null) };
}
export async function attachOutputs(attach, files, { declared, runBudget }) {
    const attachments = [];
    const missingOutputs = [];
    const rejectedOutputs = [];
    let total = 0;
    for (const name of declared) {
        const bytes = files.get(name);
        if (!bytes) {
            missingOutputs.push(name);
            continue;
        }
        const verdict = checkOutputBytes(name, bytes, total);
        if ('error' in verdict) {
            rejectedOutputs.push({ name, reason: verdict.error });
            continue;
        }
        if (runBudget && runBudget.outputBytesUsed + bytes.length > RUN_OUTPUT_BUDGET_BYTES) {
            rejectedOutputs.push({ name, reason: 'run output budget exceeded' });
            continue;
        }
        let record;
        try {
            record = await attach({
                fileName: name,
                mimeType: verdict.mimeType,
                bytes,
                raw: true
            });
        }
        catch {
            rejectedOutputs.push({ name, reason: 'the host declined to persist this file' });
            continue;
        }
        total += bytes.byteLength;
        if (runBudget) {
            runBudget.outputBytesUsed += bytes.byteLength;
        }
        attachments.push({
            attachmentId: record.id,
            fileName: record.fileName,
            byteLength: record.byteLength
        });
    }
    return { attachments, missingOutputs, rejectedOutputs };
}
function toNull() {
    return null;
}
