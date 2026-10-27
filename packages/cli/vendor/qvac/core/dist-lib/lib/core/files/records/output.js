import { MAX_REFERENCE_CHARS, parseBlobReference } from '../store/index.js';
import { isRecord } from '../../../guards.js';
const PROCESSOR_ID_SEPARATOR = ':';
export function processorArtifactId({ processorId, hash }) {
    return `${processorId}${PROCESSOR_ID_SEPARATOR}${hash}`;
}
export function isProcessorArtifactId(id) {
    return id.includes(PROCESSOR_ID_SEPARATOR);
}
export function isProcessorOutput(version) {
    return version.startsWith('processor:') && !version.includes('|');
}
export function assertArtifactOutput(output) {
    const processor = isProcessorOutput(output.embedderVersion);
    if (processor
        ? output.dimensions !== 0
        : !Number.isInteger(output.dimensions) || output.dimensions <= 0) {
        throw new Error(processor
            ? 'processor output needs zero dimensions'
            : `knowledge-artifact needs positive integer dimensions, got ${output.dimensions}`);
    }
    if (output.artifactBlobId.length > MAX_REFERENCE_CHARS) {
        throw new Error('inline output exceeds 512 KiB');
    }
    let value;
    try {
        value = JSON.parse(output.artifactBlobId);
    }
    catch {
        if (!processor) {
            return;
        }
    }
    const inline = isRecord(value) && 'inline' in value;
    if (!processor && !inline) {
        return;
    }
    const parsed = parseBlobReference(output.artifactBlobId);
    if (parsed.inline && !processor) {
        throw new Error('inline outputs need a processor identity');
    }
}
