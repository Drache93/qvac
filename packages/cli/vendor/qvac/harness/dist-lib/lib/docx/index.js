import { docx } from '../office/engine/index.js';
import { cellText, extractWith } from '../office/extract.js';
function documentText(bytes) {
    const lines = [];
    for (const block of docx.open(bytes).read().blocks) {
        if (block.type === 'table') {
            lines.push(...block.rows.map((row) => row.map(cellText).join(' | ')));
        }
        else if (block.type === 'paragraph' && block.text.trim()) {
            lines.push(block.text);
        }
    }
    return lines.join('\n');
}
export async function extractDocxText(bytes, fileName, options = {}) {
    return extractWith(bytes, { fileName, signal: options.signal, extract: documentText });
}
