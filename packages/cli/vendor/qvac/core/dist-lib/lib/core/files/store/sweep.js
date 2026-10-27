import { isPendingBlobReference, parseBlobReference, parseBlobReferenceCoreKey } from './reference.js';
import b4a from 'b4a';
export async function sweepUnreferenced(blobs, references, coreLength) {
    const ranges = [];
    const key = b4a.toHex(blobs.core.key);
    const local = { localCoreKey: key, coreLength };
    for (const reference of references) {
        addLocalRange(ranges, reference, local);
    }
    await clearGaps(blobs, mergeRanges(ranges), coreLength);
}
function addLocalRange(ranges, reference, { localCoreKey, coreLength }) {
    if (isPendingBlobReference(reference))
        return;
    const coreKey = parseBlobReferenceCoreKey(reference);
    if (coreKey && coreKey !== localCoreKey) {
        return;
    }
    const { blobId } = parseBlobReference(reference);
    const end = blobId.blockOffset + blobId.blockLength;
    if (!Number.isSafeInteger(end) || end > coreLength) {
        throw new TypeError('blob reference exceeds local core');
    }
    if (blobId.blockLength > 0) {
        ranges.push({ start: blobId.blockOffset, end });
    }
}
function mergeRanges(ranges) {
    const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [];
    for (const range of sorted) {
        const previous = merged.at(-1);
        if (!previous || range.start > previous.end) {
            merged.push(range);
            continue;
        }
        if (range.end > previous.end) {
            merged[merged.length - 1] = { start: previous.start, end: range.end };
        }
    }
    return merged;
}
async function clearGaps(blobs, ranges, coreLength) {
    let cursor = 0;
    for (const range of ranges) {
        if (cursor < range.start) {
            await blobs.core.clear(cursor, range.start);
        }
        cursor = range.end;
    }
    if (cursor < coreLength) {
        await blobs.core.clear(cursor, coreLength);
    }
}
