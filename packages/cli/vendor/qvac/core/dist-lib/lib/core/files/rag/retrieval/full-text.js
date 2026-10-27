import * as z from 'zod';
import { classifyRagDocument, extractPdfHead, extractRagDocumentFromBytes, parseRagMetadata, RAG_DOCUMENT_KIND } from 'rag-extract';
const DEFAULT_FULL_TEXT_BUDGET_TOKENS = 4096;
const CHARS_PER_TOKEN = 4;
const FULL_TEXT_KINDS = new Set([
    RAG_DOCUMENT_KIND.pdf,
    RAG_DOCUMENT_KIND.rtf,
    RAG_DOCUMENT_KIND.html,
    RAG_DOCUMENT_KIND.csv,
    RAG_DOCUMENT_KIND.tsv,
    RAG_DOCUMENT_KIND.text
]);
export function fullTextBudgetChars(ctxSize) {
    const tokens = ctxSize > 0 ? Math.floor(ctxSize / 2) : DEFAULT_FULL_TEXT_BUDGET_TOKENS;
    return tokens * CHARS_PER_TOKEN;
}
const FULL_TEXT_HIT_PREFIX = 'full-text-';
export function isFullTextHit(hit) {
    return hit.id.startsWith(FULL_TEXT_HIT_PREFIX);
}
const FullTextExtrasSchema = z.object({
    truncated: z.boolean().optional().catch(undefined),
    coverage: z
        .object({ unit: z.enum(['pages', 'chars']), included: z.number(), total: z.number() })
        .optional()
        .catch(undefined)
});
function fullTextExtras(hit) {
    try {
        const parsed = FullTextExtrasSchema.safeParse(JSON.parse(hit.metadataJson));
        return parsed.success ? parsed.data : {};
    }
    catch {
        return {};
    }
}
export function isTruncatedFullTextHit(hit) {
    return isFullTextHit(hit) && fullTextExtras(hit).truncated === true;
}
export function formatFullDocumentContext(hits) {
    const truncated = hits.find(isTruncatedFullTextHit);
    const parts = [
        truncated
            ? truncatedFraming(titleOf(truncated), fullTextExtras(truncated).coverage, hits.length > 1)
            : 'The full text of the attached document(s) follows. Answer the user from it directly.'
    ];
    for (const hit of hits) {
        const extras = fullTextExtras(hit);
        const scope = extras.truncated && extras.coverage ? ` (${describeCoverage(extras.coverage)})` : '';
        parts.push('', `--- ${titleOf(hit)}${scope} ---`, hit.content);
    }
    return parts.join('\n');
}
function titleOf(hit) {
    return parseRagMetadata(hit.metadataJson)?.title ?? 'document';
}
function truncatedFraming(title, coverage, others) {
    const read = coverage ? `Only the ${describeCoverage(coverage)}` : 'Only the opening';
    const rest = others ? ' The other attached documents follow in full.' : '';
    return `${read} of "${title}" could be read: it is too long for the model's context window. Do not try to read it again or fetch the rest with a tool, it would not fit either. Answer from what is here and say that your answer covers only the beginning of "${title}".${rest}`;
}
function describeCoverage(coverage) {
    return coverage.unit === 'pages'
        ? `first ${coverage.included} of ${coverage.total} pages`
        : `first ${formatChars(coverage.included)} of about ${formatChars(coverage.total)} characters`;
}
function formatChars(count) {
    return count >= 1000 ? `${Math.round(count / 1000)}k` : String(count);
}
export async function fullTextHits(mesh, rows, { budgetChars, head = false }) {
    if (rows.length === 0)
        return null;
    const kinds = rows.map((row) => classifyRagDocument({ fileName: row.fileName, mimeType: row.mimeType }));
    if (!kinds.every((kind) => FULL_TEXT_KINDS.has(kind))) {
        return null;
    }
    const hits = [];
    let used = 0;
    for (const [index, row] of rows.entries()) {
        const remaining = budgetChars - used;
        if (!head && kinds[index] !== RAG_DOCUMENT_KIND.pdf && row.byteLength > remaining) {
            return null;
        }
        let read;
        try {
            const bytes = await mesh.files.readBytes(row.blobId);
            read = await extractFullText(bytes, {
                kind: kinds[index],
                row,
                remainingChars: remaining,
                head
            });
        }
        catch (err) {
            mesh.log?.warn('rag', 'full-text extraction failed; falling back to retrieval', { err });
            return null;
        }
        if (!read.text) {
            return null;
        }
        const fits = read.complete && read.text.length <= remaining;
        if (!fits && !head) {
            return null;
        }
        const text = fits ? read.text : read.text.slice(0, remaining);
        used += text.length;
        hits.push({
            id: `${FULL_TEXT_HIT_PREFIX}${row.id}`,
            content: text,
            metadataJson: JSON.stringify({
                documentId: `${FULL_TEXT_HIT_PREFIX}${row.id}`,
                title: row.fileName,
                mimeType: row.mimeType,
                attachmentId: row.id,
                chatId: row.chatId,
                chunkIndex: 0,
                tokenCount: Math.ceil(text.length / 4),
                indexedAt: new Date().toISOString(),
                truncated: !fits || undefined,
                coverage: fits ? undefined : coverageOf(read, text.length)
            }),
            score: 1
        });
        if (!fits) {
            break;
        }
    }
    return hits;
}
function coverageOf(read, included) {
    if (read.pages && read.pages.read < read.pages.total) {
        return { unit: 'pages', included: read.pages.read, total: read.pages.total };
    }
    return { unit: 'chars', included, total: read.totalChars ?? read.text.length };
}
const MAX_BYTES_PER_CHAR = 4;
async function extractFullText(bytes, { kind, row, remainingChars, head }) {
    if (kind === RAG_DOCUMENT_KIND.pdf) {
        const pdf = await extractPdfHead(bytes, { maxChars: remainingChars });
        return {
            text: pdf.text,
            complete: pdf.pagesRead === pdf.totalPages,
            pages: { read: pdf.pagesRead, total: pdf.totalPages }
        };
    }
    const maxPrefixBytes = remainingChars * MAX_BYTES_PER_CHAR;
    const prefix = head && bytes.length > maxPrefixBytes;
    const document = await extractRagDocumentFromBytes({
        fileName: row.fileName,
        mimeType: row.mimeType,
        bytes: prefix ? bytes.subarray(0, maxPrefixBytes) : bytes
    });
    if (!prefix) {
        return { text: document.content, complete: true, totalChars: document.content.length };
    }
    return {
        text: document.content.replace(/\uFFFD$/, ''),
        complete: false,
        totalChars: bytes.length
    };
}
