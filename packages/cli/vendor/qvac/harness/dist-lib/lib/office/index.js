import path from 'path';
import { HarnessError } from '../errors.js';
import { extractDocxText } from '../docx/index.js';
import { pptx, xlsx } from './engine/index.js';
import { cellText, extractWith } from './extract.js';
const OFFICE_MIME_EXTENSIONS = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx'
};
const EXTRACT_CELL_LIMIT = 1_000_000;
function columnIndex(letters) {
    let index = 0;
    for (const char of letters) {
        index = index * 26 + char.charCodeAt(0) - 64;
    }
    return index;
}
function columnName(index) {
    let name = '';
    for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) {
        name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    }
    return name;
}
function trimmedRow(values) {
    const row = [...values];
    while (row.length && !cellText(row.at(-1)).trim()) {
        row.pop();
    }
    return row;
}
function workbookText(bytes) {
    const book = xlsx.open(bytes);
    let output = '';
    let budget = EXTRACT_CELL_LIMIT;
    for (const sheet of book.sheets()) {
        if (sheet.kind !== 'worksheet' || budget <= 0)
            continue;
        const { range, rows, formulas } = book.read(sheet.index, { limit: budget });
        budget -= rows.length * (rows[0]?.length ?? 0);
        const [, letters = 'A', digits = '1'] = /^([A-Z]+)(\d+)/.exec(range ?? 'A1') ?? [];
        const firstColumn = columnIndex(letters);
        const firstRow = Number(digits);
        const lines = rows
            .map((row, r) => trimmedRow(row.map((value, c) => value ?? formulas[`${columnName(firstColumn + c)}${firstRow + r}`] ?? null)))
            .filter((row) => row.length)
            .map((row) => row.map(cellText).join(' | '));
        if (lines.length) {
            output += `Sheet: ${sheet.name}\n${lines.join('\n')}\n`;
        }
    }
    return output;
}
function shapeBlocks(shape) {
    if (shape.paragraphs) {
        const text = shape.paragraphs.map((paragraph) => paragraph.text).join('\n');
        return text.trim() ? [text] : [];
    }
    return (shape.rows ?? [])
        .map((row) => row.map(cellText))
        .filter((cells) => cells.some((cell) => cell.trim()))
        .map((cells) => cells.join(' | '));
}
function deckText(bytes) {
    let output = '';
    for (const slide of pptx.open(bytes).read()) {
        const blocks = slide.shapes.flatMap(shapeBlocks);
        if (blocks.length) {
            output += `Slide ${slide.index + 1}\n${blocks.join('\n')}\n`;
        }
    }
    return output;
}
const EXTRACTORS = new Map([
    ['.xlsx', workbookText],
    ['.pptx', deckText]
]);
export async function closeOfficeWorker() { }
export async function extractOfficeText(bytes, fileName, options = {}) {
    const mimeType = options.mimeType?.split(';')[0]?.trim().toLowerCase();
    const suffix = path.extname(fileName).toLowerCase();
    const extension = ['.docx', '.xlsx', '.pptx'].includes(suffix)
        ? suffix
        : OFFICE_MIME_EXTENSIONS[mimeType ?? ''];
    if (extension === '.docx') {
        return extractDocxText(bytes, fileName, options);
    }
    const extract = EXTRACTORS.get(extension ?? '');
    if (extract) {
        return extractWith(bytes, { fileName, signal: options.signal, extract });
    }
    throw new HarnessError('OFFICE_UNSUPPORTED_DOCUMENT', [fileName]);
}
