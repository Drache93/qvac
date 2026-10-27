import { Package, referencedIds } from '../opc/package.js';
import * as xml from '../xml.js';
import * as media from '../opc/media.js';
import { probe } from '../image.js';
import * as chart from '../drawingml/chart.js';
import * as text from './text.js';
import { Styles } from './styles.js';
import * as template from './template.js';
import * as properties from '../opc/properties.js';
import { DocsError } from '../errors.js';
import { isRecord } from '../../../guards.js';
const { w: W, r: R, wp: WP, a: A, pic: PIC } = xml.ns;
const STRICT_REL = 'http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument';
const REL_BASE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const REL = {
    officeDocument: REL_BASE + 'officeDocument',
    styles: REL_BASE + 'styles',
    header: REL_BASE + 'header',
    footer: REL_BASE + 'footer',
    chart: REL_BASE + 'chart',
    image: REL_BASE + 'image',
    hyperlink: REL_BASE + 'hyperlink',
    footnotes: REL_BASE + 'footnotes',
    endnotes: REL_BASE + 'endnotes',
    comments: REL_BASE + 'comments'
};
const DROPPABLE = [REL.image, REL.chart, REL.hyperlink, REL.header, REL.footer];
const DRAWING_PARTS = [REL.header, REL.footer, REL.footnotes, REL.endnotes, REL.comments];
const HEADER_TYPES = {
    header: 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml',
    footer: 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml'
};
const SECTION_ORDER = [
    'headerReference',
    'footerReference',
    'footnotePr',
    'endnotePr',
    'type',
    'pgSz',
    'pgMar',
    'paperSrc',
    'pgBorders',
    'lnNumType',
    'pgNumType',
    'cols',
    'formProt',
    'vAlign',
    'noEndnote',
    'titlePg',
    'textDirection',
    'bidi',
    'rtlGutter',
    'docGrid',
    'printerSettings',
    'sectPrChange'
];
const MAIN_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml',
    'application/vnd.ms-word.document.macroEnabled.main+xml',
    'application/vnd.ms-word.template.macroEnabledTemplate.main+xml'
]);
const BLOCKS = new Set(['p', 'tbl', 'sdt']);
const WRAPPERS = new Set(['sdt', 'customXml']);
const CELL_BLOCKS = new Set(['p', 'tbl', 'sdt', 'customXml']);
const WRAPPER_PROPERTIES = new Set(['sdtPr', 'sdtEndPr', 'customXmlPr']);
const UNWRAPPED = ['sdt', 'customXml', 'ins', 'moveTo'];
const UNTRACKED = [
    'del',
    'moveFrom',
    'rPrChange',
    'pPrChange',
    'trPrChange',
    'tcPrChange',
    'tblPrExChange',
    'sectPrChange',
    'numberingChange',
    'cellIns',
    'cellDel',
    'cellMerge',
    'moveFromRangeStart',
    'moveFromRangeEnd',
    'moveToRangeStart',
    'moveToRangeEnd',
    'bookmarkStart',
    'bookmarkEnd',
    'commentRangeStart',
    'commentRangeEnd',
    'permStart',
    'permEnd'
];
const NOTE_REFERENCES = ['commentReference', 'footnoteReference', 'endnoteReference'];
const MARKS = new Set(['trPr', 'rPr']);
const NOTE_TYPES = ['separator', 'continuationSeparator', 'continuationNotice'];
const PIC_URI = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
const EMU_PER_TWIP = 635;
const EMU_PER_PIXEL = 9525;
function isBlock(el) {
    return BLOCKS.has(el.localName ?? '');
}
function blocksOf(parent) {
    return xml.children(parent, W).filter(isBlock);
}
function textOf(parent) {
    return blocksOf(parent).map(text.blockText).join('\n').trim();
}
function withRemoved(result, removed) {
    if (Object.keys(removed).length) {
        result.removed = removed;
    }
    return result;
}
function validateRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0 || !rows.every(Array.isArray)) {
        throw new DocsError('INVALID_TABLE', 'rows must be a non-empty array of rows, each an array of cells');
    }
    const columns = Math.max(...rows.map((r) => r.length));
    if (columns === 0) {
        throw new DocsError('INVALID_TABLE', 'the table has no columns');
    }
    if (rows.length > 5000 || columns > 63) {
        throw new DocsError('INVALID_TABLE', 'a table holds at most 5000 rows and 63 columns');
    }
    return rows.map((row, r) => row.map((value, c) => {
        if (value === null || typeof value === 'string')
            return value;
        if (typeof value === 'number' && Number.isFinite(value))
            return value;
        throw new DocsError('INVALID_TABLE', `cell ${r},${c} must be a string, a number or null`);
    }));
}
function cellText(value) {
    return value === null || value === undefined ? '' : String(value);
}
function borders(doc) {
    const el = text.wEl(doc, 'tblBorders');
    for (const side of ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']) {
        el.appendChild(text.wEl(doc, side, { val: 'single', sz: 4, space: 0, color: 'auto' }));
    }
    return el;
}
function inlineDrawing(graphic, frame) {
    const doc = xml.owner(graphic);
    const wp = xml.builder(doc, WP);
    const a = xml.builder(doc, A);
    const drawing = text.wEl(doc, 'drawing');
    const inline = xml.append(drawing, wp('inline', { distT: 0, distB: 0, distL: 0, distR: 0 }));
    inline.appendChild(wp('extent', { cx: frame.size.width, cy: frame.size.height }));
    inline.appendChild(wp('effectExtent', { l: 0, t: 0, r: 0, b: 0 }));
    inline.appendChild(wp('docPr', { id: frame.id, name: frame.name, descr: frame.description }));
    xml
        .append(inline, wp('cNvGraphicFramePr'))
        .appendChild(a('graphicFrameLocks', { noChangeAspect: 1 }));
    inline.appendChild(graphic);
    return drawing;
}
function pictureGraphic(doc, frame) {
    const a = xml.builder(doc, A);
    const pic = xml.builder(doc, PIC);
    const graphic = a('graphic');
    const data = xml.append(graphic, a('graphicData', { uri: PIC_URI }));
    const picture = xml.append(data, pic('pic'));
    const nv = xml.append(picture, pic('nvPicPr'));
    nv.appendChild(pic('cNvPr', { id: frame.id, name: frame.name, descr: frame.description }));
    nv.appendChild(pic('cNvPicPr'));
    const fill = xml.append(picture, pic('blipFill'));
    const blip = xml.append(fill, a('blip'));
    xml.setNsAttribute(blip, { namespace: R, local: 'embed' }, frame.rId);
    xml.append(fill, a('stretch')).appendChild(a('fillRect'));
    const spPr = xml.append(picture, pic('spPr'));
    const xfrm = xml.append(spPr, a('xfrm'));
    xfrm.appendChild(a('off', { x: 0, y: 0 }));
    xfrm.appendChild(a('ext', { cx: frame.size.width, cy: frame.size.height }));
    xml.append(spPr, a('prstGeom', { prst: 'rect' })).appendChild(a('avLst'));
    return graphic;
}
function chartGraphic(doc, rId) {
    const a = xml.builder(doc, A);
    const graphic = a('graphic');
    const data = xml.append(graphic, a('graphicData', { uri: chart.GRAPHIC_URI }));
    const ref = xml.append(data, xml.named(doc, 'c:chart', chart.C));
    ref.setAttributeNS(R, 'r:id', rId);
    return graphic;
}
function isEmptyParagraph(p) {
    return xml.children(p, W).every((n) => n.localName === 'pPr');
}
function contentOf(wrapper) {
    return xml.child(wrapper, W, 'sdtContent') ?? wrapper;
}
function unwrapped(parent, local) {
    const out = [];
    for (const el of xml.children(parent, W)) {
        if (el.localName === local) {
            out.push(el);
        }
        else if (WRAPPERS.has(el.localName ?? '')) {
            out.push(...unwrapped(contentOf(el), local));
        }
    }
    return out;
}
function firstParagraph(parent) {
    for (const el of xml.children(parent, W)) {
        if (el.localName === 'p') {
            return el;
        }
        const found = WRAPPERS.has(el.localName ?? '') ? firstParagraph(contentOf(el)) : null;
        if (found) {
            return found;
        }
    }
    return null;
}
function clearCell(tc) {
    const keep = firstParagraph(tc);
    if (!keep) {
        for (const el of xml.children(tc, W).filter((n) => CELL_BLOCKS.has(n.localName ?? ''))) {
            xml.remove(el);
        }
        return xml.append(tc, text.wEl(xml.owner(tc), 'p'));
    }
    for (let node = keep; node !== tc && node.parentNode; node = node.parentNode) {
        for (const el of xml.children(node.parentNode, W)) {
            if (el !== node && CELL_BLOCKS.has(el.localName ?? '')) {
                xml.remove(el);
            }
        }
    }
    clearPlaceholders(keep);
    return keep;
}
function clearPlaceholders(from) {
    for (let node = from.parentNode; node && !xml.isElement(node, W, 'tbl'); node = node.parentNode) {
        const sdtPr = xml.isElement(node, W, 'sdt') ? xml.child(node, W, 'sdtPr') : null;
        for (const el of sdtPr ? xml.children(sdtPr, W, 'showingPlcHdr') : []) {
            xml.remove(el);
        }
    }
}
function unwrap(el) {
    const parent = el.parentNode;
    if (!parent) {
        return;
    }
    for (const child of xml.children(contentOf(el))) {
        if (!WRAPPER_PROPERTIES.has(child.localName ?? '')) {
            parent.insertBefore(child, el);
        }
    }
    xml.remove(el);
}
function dropHeaderMark(tr) {
    const trPr = xml.child(tr, W, 'trPr');
    for (const h of trPr ? xml.children(trPr, W, 'tblHeader') : []) {
        xml.remove(h);
    }
}
function insertRow(tr, { tbl, rows, at }) {
    const before = rows[at - 1];
    if (before?.parentNode) {
        before.parentNode.insertBefore(tr, before.nextSibling);
    }
    else {
        ;
        (rows[0]?.parentNode ?? tbl).insertBefore(tr, rows[0] ?? null);
    }
}
function plainRow(tr) {
    for (let el = firstOf(tr, UNWRAPPED); el; el = firstOf(tr, UNWRAPPED)) {
        if (MARKS.has(el.parentNode?.localName ?? '')) {
            xml.remove(el);
        }
        else {
            unwrap(el);
        }
    }
    for (const local of UNTRACKED) {
        for (const el of xml.descendants(tr, W, local)) {
            xml.remove(el);
        }
    }
    for (const r of xml.descendants(tr, W, 'r')) {
        if (NOTE_REFERENCES.some((ref) => xml.child(r, W, ref))) {
            xml.remove(r);
        }
    }
    return tr;
}
function firstOf(el, locals) {
    for (const local of locals) {
        const found = xml.descendants(el, W, local)[0];
        if (found) {
            return found;
        }
    }
    return null;
}
function removeEmptyWrappers(from, stop) {
    let node = from;
    while (node && node !== stop && xml.isElement(node, W)) {
        const wrapper = node.localName === 'sdtContent' ? node.parentNode : node;
        if (!xml.isElement(wrapper, W) || !WRAPPERS.has(wrapper.localName ?? '')) {
            return;
        }
        const content = xml.children(contentOf(wrapper));
        if (content.some((el) => !WRAPPER_PROPERTIES.has(el.localName ?? ''))) {
            return;
        }
        node = wrapper.parentNode;
        xml.remove(wrapper);
    }
}
function checkPositive(values) {
    for (const [key, value] of Object.entries(values)) {
        if (value !== undefined &&
            !(typeof value === 'number' && Number.isInteger(value) && value > 0)) {
            throw new DocsError('INVALID_BOX', `${key} must be a positive whole number of EMU, got ${String(value)}`);
        }
    }
}
function mainPart(pkg) {
    const main = pkg.related('/', REL.officeDocument)[0];
    if (main && MAIN_TYPES.has(pkg.contentType(main) ?? '')) {
        return main;
    }
    if (pkg.rels('/').byType(STRICT_REL).length) {
        throw new DocsError('UNSUPPORTED_DOCX', 'the document uses Strict Open XML, which is not supported');
    }
    throw new DocsError('NOT_DOCX', 'the file is not a Word document');
}
export class Document {
    package;
    main;
    styles;
    orphans;
    constructor(pkg) {
        this.package = pkg;
        this.main = mainPart(pkg);
        const top = pkg.root(this.main);
        if (top.namespaceURI !== W || top.localName !== 'document') {
            throw new DocsError('UNSUPPORTED_DOCX', 'the document uses Strict Open XML, which is not supported');
        }
        this.styles = new Styles(pkg, pkg.related(this.main, REL.styles)[0] ?? null);
        this.orphans = new Set(this.unreferenced());
    }
    static open(bytes, opts) {
        return new Document(Package.open(bytes, opts));
    }
    static create(opts = {}) {
        const pkg = Package.create();
        template.build(pkg, opts);
        return new Document(pkg);
    }
    get changed() {
        return this.package.changed;
    }
    get blockCount() {
        return this.blocks().length;
    }
    read(opts = {}) {
        const all = this.blocks();
        const from = opts.from ?? 0;
        const count = opts.count ?? Math.max(all.length, 1);
        if (!Number.isInteger(from) || from < 0 || (from >= all.length && all.length > 0)) {
            throw new DocsError('INVALID_OPTIONS', `from must be a block index from 0 to ${Math.max(0, all.length - 1)}, got ${String(opts.from)}`);
        }
        if (!Number.isInteger(count) || count < 1) {
            throw new DocsError('INVALID_OPTIONS', `count must be at least 1, got ${String(opts.count)}`);
        }
        return {
            total: all.length,
            blocks: all.slice(from, from + count).map((el, i) => this.describe(el, from + i)),
            headers: this.partTexts(REL.header),
            footers: this.partTexts(REL.footer),
            footnotes: this.notes(),
            comments: this.comments()
        };
    }
    setHeader(value, opts = {}) {
        return this.setHeaderFooter({ kind: 'header', type: headerType(opts) }, value);
    }
    setFooter(value, opts = {}) {
        return this.setHeaderFooter({ kind: 'footer', type: headerType(opts) }, value);
    }
    paragraphStyles() {
        return this.styles.names('paragraph');
    }
    setText(index, input) {
        const p = this.paragraph(index);
        const before = text.paragraphText(p);
        const runs = text.normalizeRuns(input);
        const plain = runs.every((run) => Object.keys(run).length === 1);
        if (plain && runs.map((run) => run.text).join('') === before) {
            return { changed: false };
        }
        text.assertUntracked(p, `block ${index}`);
        const removed = text.replaceContent(p, input);
        this.touch();
        return withRemoved({ changed: true }, removed);
    }
    insertParagraphs(at, specs) {
        const blocks = this.blocks();
        this.position(at, blocks.length);
        const list = this.specs(specs);
        const before = this.templateBefore(blocks, at);
        const { anchor, index, trailer } = this.anchor(blocks, at);
        const body = this.body();
        const blank = this.blankOnly(blocks);
        for (const spec of list) {
            body.insertBefore(this.build(spec, before), anchor);
        }
        if (blank) {
            xml.remove(blank);
        }
        if (trailer) {
            xml.remove(trailer);
        }
        this.touch();
        const shift = blank && index > 0 ? 1 : 0;
        return { index: index - shift, count: list.length };
    }
    appendParagraphs(specs) {
        return this.insertParagraphs(this.blockCount, specs);
    }
    deleteBlocks(index, opts = {}) {
        const count = opts.count ?? 1;
        const blocks = this.blocks();
        this.block(index);
        if (!Number.isInteger(count) || count < 1 || index + count > blocks.length) {
            throw new DocsError('BLOCK_NOT_FOUND', `count must be from 1 to ${blocks.length - index} when deleting from block ${index}`);
        }
        for (const el of blocks.slice(index, index + count)) {
            xml.remove(el);
        }
        this.ensureTrailingParagraph();
        this.touch();
        return { blocks: this.blockCount };
    }
    sections() {
        const blocks = this.blocks();
        const out = [];
        blocks.forEach((el, index) => {
            const level = this.headingLevel(el);
            if (level === null || level < 1) {
                return;
            }
            out.push({
                index,
                level,
                title: text.paragraphText(el),
                end: this.sectionEnd(blocks, { index, level })
            });
        });
        return out;
    }
    replaceSection(index, opts = {}) {
        const blocks = this.blocks();
        const level = this.heading(blocks, index);
        const end = this.sectionEnd(blocks, { index, level });
        const body = blocks.slice(index + 1, end);
        const list = opts.body === undefined ? null : this.specs(opts.body);
        if (opts.title !== undefined) {
            text.assertUntracked(blocks[index], `heading ${index}`);
            text.replaceContent(blocks[index], opts.title);
        }
        if (list) {
            const model = body.find((el) => el.localName === 'p' && this.headingLevel(el) === null && !this.isList(el));
            const anchor = blocks[end] ?? this.sectPr();
            for (const spec of list) {
                this.body().insertBefore(this.build(spec, model ?? null), anchor);
            }
            for (const el of body) {
                xml.remove(el);
            }
        }
        this.touch();
        return { index, removed: list ? body.length : 0, added: list ? list.length : 0 };
    }
    deleteSection(index) {
        const blocks = this.blocks();
        const level = this.heading(blocks, index);
        const end = this.sectionEnd(blocks, { index, level });
        return this.deleteBlocks(index, { count: end - index });
    }
    formatParagraph(index, input) {
        const p = this.paragraph(index);
        const { align, ...run } = text.validateFormat(input);
        if (align) {
            text.setAlign(p, align);
        }
        if (Object.keys(run).length) {
            for (const r of xml.descendants(p, W, 'r')) {
                if (!xml.child(r, W, 't'))
                    continue;
                let rPr = xml.child(r, W, 'rPr');
                if (!rPr) {
                    rPr = text.wEl(xml.owner(r), 'rPr');
                    r.insertBefore(rPr, r.firstChild);
                }
                text.applyRunFormat(rPr, run);
            }
        }
        this.touch();
        return { changed: true };
    }
    format(index, input) {
        return this.formatParagraph(index, input);
    }
    formatStyle(name, input) {
        if (!this.styles.part) {
            throw new DocsError('STYLE_NOT_FOUND', 'the document has no styles part');
        }
        return this.styles.format(name, input);
    }
    addTable(at, opts) {
        const blocks = this.blocks();
        this.position(at, blocks.length);
        const rows = validateRows(isRecord(opts) ? opts.rows : undefined);
        const columns = Math.max(...rows.map((r) => r.length));
        const header = opts.header !== false;
        const tbl = this.tableElement({ rows, columns, header, styleId: this.tableStyleId(opts.style) });
        const { anchor, index } = this.anchor(blocks, at);
        this.body().insertBefore(tbl, anchor);
        this.ensureTrailingParagraph();
        this.touch();
        return { index, rows: rows.length, columns };
    }
    setCell(cell, input) {
        const tc = this.cell(cell);
        text.assertUntracked(tc, `cell ${cell.row},${cell.column}`);
        const removed = text.replaceContent(clearCell(tc), input);
        this.touch();
        return withRemoved({ changed: true }, removed);
    }
    addRow(table, values, opts = {}) {
        const tbl = this.table(table);
        const rows = unwrapped(tbl, 'tr');
        const at = opts.at ?? rows.length;
        if (!Number.isInteger(at) || at < 0 || at > rows.length) {
            throw new DocsError('ROW_NOT_FOUND', `at must be a row position from 0 to ${rows.length}, got ${String(opts.at)}`);
        }
        if (!Array.isArray(values)) {
            throw new DocsError('INVALID_TABLE', 'values must be an array of cell texts');
        }
        const model = at > 0 && rows[at - 1] ? rows[at - 1] : rows[rows.length > 1 ? 1 : 0];
        const tr = plainRow(xml.clone(model));
        dropHeaderMark(tr);
        const cells = xml.children(tr, W, 'tc');
        if (values.length > cells.length) {
            throw new DocsError('INVALID_TABLE', `the row has ${cells.length} cells but ${values.length} values were given`);
        }
        cells.forEach((tc, c) => fillCell(tc, cellText(values[c])));
        insertRow(tr, { tbl, rows, at });
        this.touch();
        return { rows: rows.length + 1 };
    }
    deleteRow(ref) {
        const tbl = this.table(ref.table);
        const rows = unwrapped(tbl, 'tr');
        const tr = rows[ref.row];
        if (!tr) {
            throw new DocsError('ROW_NOT_FOUND', `row ${ref.row} does not exist; the table has ${rows.length} (0 to ${rows.length - 1})`);
        }
        if (rows.length === 1) {
            throw new DocsError('LAST_ROW', "this is the table's only row; delete the table with deleteBlocks instead");
        }
        if (xml.descendants(tr, W, 'vMerge').length) {
            throw new DocsError('ROW_MERGED', `row ${ref.row} is part of a vertically merged cell; unmerge it in Word first`);
        }
        const parent = tr.parentNode;
        xml.remove(tr);
        removeEmptyWrappers(parent, tbl);
        this.touch();
        return { rows: rows.length - 1 };
    }
    addImage(at, bytes, opts = {}) {
        const blocks = this.blocks();
        this.position(at, blocks.length);
        const size = this.imageSize(probe(bytes), opts);
        const { rId } = media.addImage(this.package, bytes, { source: this.main, dir: 'media' });
        const doc = this.doc();
        const id = this.nextDocPrId();
        const p = text.wEl(doc, 'p');
        if (opts.align) {
            const { align } = text.validateFormat({ align: opts.align });
            if (align) {
                text.setAlign(p, align);
            }
        }
        const frame = { id, size, name: opts.name || `Picture ${id}`, description: opts.description };
        xml
            .append(p, text.wEl(doc, 'r'))
            .appendChild(inlineDrawing(pictureGraphic(doc, { ...frame, rId }), frame));
        return { index: this.place(p, { blocks, at }), ...size };
    }
    addChart(at, spec) {
        const blocks = this.blocks();
        this.position(at, blocks.length);
        const width = spec.width ?? this.textWidth() * EMU_PER_TWIP;
        const height = spec.height ?? Math.round(width * 0.6);
        checkPositive({ width, height });
        const part = this.package.freeName('/word/charts/chart%d.xml');
        chart.createChart({ pkg: this.package, part }, spec);
        const rId = this.package.rels(this.main).add(REL.chart, part);
        const doc = this.doc();
        const id = this.nextDocPrId();
        const p = text.wEl(doc, 'p');
        const frame = { id, size: { width, height }, name: spec.name || `Chart ${id}` };
        xml.append(p, text.wEl(doc, 'r')).appendChild(inlineDrawing(chartGraphic(doc, rId), frame));
        return { index: this.place(p, { blocks, at }), width, height };
    }
    setChartData(index, data, opts = {}) {
        return chart.setChartData({ pkg: this.package, part: this.chartPart(index, opts.chart ?? 0) }, data);
    }
    setChartTitle(index, title, opts = {}) {
        if (!(title === null || typeof title === 'string' || Array.isArray(title))) {
            throw new DocsError('INVALID_TEXT', 'title must be text, or null to remove it');
        }
        return chart.setChartTitle({ pkg: this.package, part: this.chartPart(index, opts.chart ?? 0) }, title);
    }
    save(opts) {
        if (this.package.has(this.main)) {
            this.dropOrphaned();
        }
        properties.applySaveOptions(this.package, opts);
        return this.package.save();
    }
    doc() {
        return this.package.xml(this.main);
    }
    unreferenced() {
        const used = referencedIds(this.package.root(this.main));
        return this.package
            .rels(this.main)
            .all()
            .filter((rel) => DROPPABLE.includes(rel.type) && !used.has(rel.id))
            .map((rel) => rel.id);
    }
    dropOrphaned() {
        const rels = this.package.rels(this.main);
        const dropped = this.unreferenced().filter((id) => !this.orphans.has(id));
        for (const id of dropped) {
            rels.remove(id);
        }
        if (dropped.length) {
            this.package.prune();
        }
    }
    body() {
        const body = xml.child(this.package.root(this.main), W, 'body');
        if (!body) {
            throw new DocsError('BROKEN_DOCX', 'the document has no body');
        }
        return body;
    }
    sectPr() {
        return xml.child(this.body(), W, 'sectPr');
    }
    blocks() {
        return blocksOf(this.body());
    }
    touch() {
        this.package.touch(this.main);
    }
    block(index) {
        const blocks = this.blocks();
        const found = Number.isInteger(index) && index >= 0 ? blocks[index] : undefined;
        if (!found) {
            const range = blocks.length ? ` (0 to ${blocks.length - 1})` : '';
            throw new DocsError('BLOCK_NOT_FOUND', `block ${index} does not exist; the document has ${blocks.length} blocks${range}`);
        }
        return found;
    }
    paragraph(index) {
        const el = this.block(index);
        if (el.localName === 'p') {
            return el;
        }
        const kind = el.localName === 'tbl' ? 'a table; use setCell' : 'a content control and cannot be edited';
        throw new DocsError('NOT_PARAGRAPH', `block ${index} is ${kind}`);
    }
    table(index) {
        const el = this.block(index);
        if (el.localName !== 'tbl') {
            throw new DocsError('NOT_TABLE', `block ${index} is not a table`);
        }
        return el;
    }
    cell(ref) {
        const { row, column } = ref;
        const rows = unwrapped(this.table(ref.table), 'tr');
        const tr = Number.isInteger(row) && row >= 0 ? rows[row] : undefined;
        if (!tr) {
            throw new DocsError('CELL_NOT_FOUND', `row ${row} does not exist; the table has ${rows.length} (0 to ${rows.length - 1})`);
        }
        const cells = unwrapped(tr, 'tc');
        const tc = Number.isInteger(column) && column >= 0 ? cells[column] : undefined;
        if (!tc) {
            throw new DocsError('CELL_NOT_FOUND', `column ${column} does not exist; the row has ${cells.length} (0 to ${cells.length - 1})`);
        }
        return checkMerge(tc, ref);
    }
    anchor(blocks, at) {
        if (at < blocks.length) {
            return { anchor: blocks[at], index: at, trailer: null };
        }
        const last = blocks[blocks.length - 1];
        const before = blocks[blocks.length - 2];
        const trailer = !!last &&
            !!before &&
            before.localName === 'tbl' &&
            last.localName === 'p' &&
            isEmptyParagraph(last);
        if (trailer) {
            return { anchor: last, index: at - 1, trailer: last };
        }
        return { anchor: this.sectPr(), index: at, trailer: null };
    }
    place(p, where) {
        const { anchor, index, trailer } = this.anchor(where.blocks, where.at);
        this.body().insertBefore(p, anchor);
        if (trailer) {
            xml.remove(trailer);
        }
        this.touch();
        return index;
    }
    position(at, length) {
        if (!Number.isInteger(at) || at < 0 || at > length) {
            throw new DocsError('BLOCK_NOT_FOUND', `at must be a position from 0 to ${length}, got ${at}`);
        }
    }
    specs(specs) {
        const list = Array.isArray(specs) ? specs : [specs];
        if (list.length === 0) {
            throw new DocsError('INVALID_TEXT', 'give at least one paragraph');
        }
        return list.map((spec) => {
            if (isRecord(spec) && spec.style !== undefined) {
                return { ...spec, styleId: this.styles.require(spec.style).id };
            }
            return spec;
        });
    }
    build(spec, model) {
        const p = text.buildParagraph(this.doc(), spec, model);
        if (isRecord(spec) && spec.level !== undefined) {
            this.setLevel(p, spec.level);
        }
        return p;
    }
    setLevel(p, level) {
        if (!(typeof level === 'number' && Number.isInteger(level) && level >= 0 && level <= 8)) {
            throw new DocsError('INVALID_TEXT', `level must be an integer from 0 to 8, got ${String(level)}`);
        }
        const pPr = text.ensure(p, 'pPr');
        const own = xml.child(pPr, W, 'numPr');
        const numId = text.wGet(own ? xml.child(own, W, 'numId') : null, 'val') ||
            this.styles.numIdOf(this.styleIdOf(p));
        if (!numId || numId === '0') {
            throw new DocsError('INVALID_TEXT', 'level applies to list paragraphs; give a list style such as "List Bullet"');
        }
        if (own) {
            xml.remove(own);
        }
        const doc = xml.owner(p);
        const numPr = xml.insertOrdered(pPr, text.wEl(doc, 'numPr'), text.PARAGRAPH_ORDER);
        numPr.appendChild(text.wEl(doc, 'ilvl', { val: level }));
        numPr.appendChild(text.wEl(doc, 'numId', { val: numId }));
    }
    sectionList() {
        return xml
            .descendants(this.body(), W, 'sectPr')
            .filter((el) => !xml.isElement(el.parentNode, W, 'sectPrChange'));
    }
    setHeaderFooter(target, value) {
        const sections = this.sectionList();
        if (sections.length === 0) {
            throw new DocsError('BROKEN_DOCX', 'the document has no section properties');
        }
        const refs = sections.flatMap((sectPr) => xml
            .children(sectPr, W, `${target.kind}Reference`)
            .filter((r) => (text.wGet(r, 'type') || 'default') === target.type));
        if (value === null) {
            for (const ref of refs) {
                xml.remove(ref);
            }
            this.touch();
            return { changed: refs.length > 0 };
        }
        const paragraphs = headerParagraphs(value, target.kind);
        const parts = this.headerParts(refs);
        if (parts.length === 0) {
            parts.push(this.createHeaderPart(target, sections[0]));
        }
        for (const part of parts) {
            this.fillHeaderPart(part, paragraphs);
        }
        return { changed: true, parts: parts.length };
    }
    headerParts(refs) {
        const rels = this.package.rels(this.main);
        const parts = new Set();
        for (const ref of refs) {
            const rel = rels.get(ref.getAttributeNS(R, 'id'));
            if (rel && !rel.external && rel.part && this.package.has(rel.part)) {
                parts.add(rel.part);
            }
        }
        return [...parts];
    }
    createHeaderPart(target, first) {
        const pkg = this.package;
        const part = pkg.freeName(`/word/${target.kind}%d.xml`);
        const style = this.styles.resolve(target.kind === 'header' ? 'Header' : 'Footer');
        const rootName = target.kind === 'header' ? 'hdr' : 'ftr';
        const doc = xml.parse(`<w:${rootName} xmlns:w="${W}" xmlns:r="${R}"><w:p/></w:${rootName}>`);
        const p = xml.child(xml.root(doc), W, 'p');
        if (style && p) {
            text.ensure(p, 'pPr').appendChild(text.wEl(doc, 'pStyle', { val: style.id }));
        }
        pkg.add(part, doc, HEADER_TYPES[target.kind]);
        const rId = pkg.rels(this.main).add(target.kind === 'header' ? REL.header : REL.footer, part);
        const main = this.doc();
        const ref = xml.insertOrdered(first, text.wEl(main, `${target.kind}Reference`, { type: target.type }), SECTION_ORDER);
        xml.setNsAttribute(ref, { namespace: R, local: 'id' }, rId);
        if (target.type === 'first' && !xml.child(first, W, 'titlePg')) {
            xml.insertOrdered(first, text.wEl(main, 'titlePg'), SECTION_ORDER);
        }
        this.touch();
        return part;
    }
    fillHeaderPart(part, paragraphs) {
        const doc = this.package.xml(part);
        const top = xml.root(doc);
        const blocks = blocksOf(top);
        const model = blocks.find((el) => el.localName === 'p') ?? null;
        for (const spec of paragraphs) {
            top.insertBefore(text.buildParagraph(doc, spec, model), blocks[0] ?? null);
        }
        for (const el of blocks) {
            xml.remove(el);
        }
        this.package.touch(part);
    }
    notes() {
        const part = this.package.related(this.main, REL.footnotes)[0];
        if (!part) {
            return [];
        }
        return xml
            .children(this.package.root(part), W, 'footnote')
            .filter((el) => !NOTE_TYPES.includes(text.wGet(el, 'type')))
            .map((el) => ({ id: text.wGet(el, 'id'), text: textOf(el) }));
    }
    comments() {
        const part = this.package.related(this.main, REL.comments)[0];
        if (!part) {
            return [];
        }
        return xml.children(this.package.root(part), W, 'comment').map((el) => ({
            id: text.wGet(el, 'id'),
            author: text.wGet(el, 'author') || null,
            text: textOf(el)
        }));
    }
    templateBefore(blocks, at) {
        for (let i = at - 1; i >= 0; i--) {
            const el = blocks[i];
            if (el.localName !== 'p' || this.headingLevel(el) !== null) {
                return null;
            }
            if (text.paragraphText(el) === '' && !xml.descendants(el, W, 'r').length) {
                continue;
            }
            return el;
        }
        return null;
    }
    blankOnly(blocks) {
        if (blocks.length !== 1 || blocks[0].localName !== 'p')
            return null;
        return isEmptyParagraph(blocks[0]) ? blocks[0] : null;
    }
    ensureTrailingParagraph() {
        const blocks = this.blocks();
        const last = blocks[blocks.length - 1];
        if (!last || last.localName !== 'p') {
            this.body().insertBefore(text.wEl(this.doc(), 'p'), this.sectPr());
        }
    }
    styleIdOf(p) {
        const pPr = xml.child(p, W, 'pPr');
        const pStyle = pPr ? xml.child(pPr, W, 'pStyle') : null;
        return pStyle ? pStyle.getAttributeNS(W, 'val') : null;
    }
    headingLevel(el) {
        if (el.localName !== 'p')
            return null;
        const pPr = xml.child(el, W, 'pPr');
        const outline = pPr ? xml.child(pPr, W, 'outlineLvl') : null;
        if (outline) {
            const level = Number(text.wGet(outline, 'val'));
            return level < 9 ? level + 1 : null;
        }
        return this.styles.headingLevel(this.styleIdOf(el));
    }
    isList(p) {
        const pPr = xml.child(p, W, 'pPr');
        const numPr = pPr ? xml.child(pPr, W, 'numPr') : null;
        const numId = numPr ? text.wGet(xml.child(numPr, W, 'numId'), 'val') : '';
        if (numId) {
            return numId !== '0';
        }
        return this.styles.isList(this.styleIdOf(p));
    }
    heading(blocks, index) {
        this.block(index);
        const level = this.headingLevel(blocks[index]);
        if (level === null || level < 1) {
            const headings = this.sections().map((s) => `${s.index} "${s.title}"`);
            throw new DocsError('NOT_HEADING', `block ${index} is not a heading; the headings are ${headings.join(', ') || 'none'}`);
        }
        return level;
    }
    sectionEnd(blocks, start) {
        for (let i = start.index + 1; i < blocks.length; i++) {
            const other = this.headingLevel(blocks[i]);
            if (other !== null && other <= start.level) {
                return i;
            }
        }
        return blocks.length;
    }
    describe(el, index) {
        if (el.localName === 'tbl') {
            return { index, type: 'table', rows: tableRows(el) };
        }
        if (el.localName === 'sdt') {
            return { index, type: 'other', text: text.blockText(el) };
        }
        const out = {
            index,
            type: 'paragraph',
            style: this.styles.nameOf(this.styleIdOf(el)),
            text: text.paragraphText(el)
        };
        const level = this.headingLevel(el);
        if (level !== null) {
            out.heading = level;
        }
        if (this.isList(el)) {
            out.list = true;
            out.level = listLevel(el);
        }
        describeExtras(el, out);
        const charts = this.chartParts(el);
        if (charts.length) {
            out.charts = charts.map((part) => chart.readChart(this.package.xml(part)));
        }
        if (text.hasPageBreak(el)) {
            out.pageBreak = true;
        }
        return out;
    }
    chartParts(el) {
        const rels = this.package.rels(this.main);
        const out = [];
        for (const ref of xml.descendants(el, chart.C, 'chart')) {
            const rel = rels.get(ref.getAttributeNS(R, 'id'));
            if (rel && !rel.external && rel.part && this.package.has(rel.part)) {
                out.push(rel.part);
            }
        }
        return out;
    }
    chartPart(index, which) {
        const parts = this.chartParts(this.block(index));
        if (parts.length === 0) {
            throw new DocsError('NOT_CHART', `block ${index} holds no chart`);
        }
        const part = parts[which];
        if (!part) {
            throw new DocsError('NOT_CHART', `block ${index} holds ${parts.length} chart(s); chart ${which} does not exist`);
        }
        return part;
    }
    partTexts(type) {
        const out = [];
        for (const part of this.package.related(this.main, type)) {
            const value = textOf(this.package.root(part));
            if (value && !out.includes(value)) {
                out.push(value);
            }
        }
        return out;
    }
    textWidth() {
        const sectPr = this.sectPr();
        const pgSz = sectPr ? xml.child(sectPr, W, 'pgSz') : null;
        const pgMar = sectPr ? xml.child(sectPr, W, 'pgMar') : null;
        const width = pgSz ? Number(text.wGet(pgSz, 'w')) : 12240;
        const left = pgMar ? Number(text.wGet(pgMar, 'left')) : 1440;
        const right = pgMar ? Number(text.wGet(pgMar, 'right')) : 1440;
        const usable = width - left - right;
        return usable > 0 ? usable : 9360;
    }
    imageSize(info, opts) {
        checkPositive({ width: opts.width, height: opts.height });
        const ratio = info.height / info.width;
        if (opts.width !== undefined && opts.height !== undefined) {
            return { width: opts.width, height: opts.height };
        }
        if (opts.width !== undefined) {
            return { width: opts.width, height: Math.round(opts.width * ratio) };
        }
        if (opts.height !== undefined) {
            return { width: Math.round(opts.height / ratio), height: opts.height };
        }
        const width = Math.min(info.width * EMU_PER_PIXEL, this.textWidth() * EMU_PER_TWIP);
        return { width, height: Math.round(width * ratio) };
    }
    nextDocPrId() {
        const parts = [
            this.main,
            ...DRAWING_PARTS.flatMap((type) => this.package.related(this.main, type))
        ];
        let max = 0;
        for (const part of parts) {
            for (const el of xml.descendants(this.package.xml(part), WP, 'docPr')) {
                max = Math.max(max, Number(el.getAttribute('id')) || 0);
            }
        }
        return max + 1;
    }
    tableStyleId(style) {
        if (style !== undefined) {
            return this.styles.require(style, 'table').id;
        }
        return this.styles.resolve('Table Grid', 'table')?.id ?? null;
    }
    tableElement(spec) {
        const doc = this.doc();
        const cellWidth = Math.floor(this.textWidth() / spec.columns);
        const tbl = text.wEl(doc, 'tbl');
        tbl.appendChild(tableProperties(doc, spec));
        const grid = xml.append(tbl, text.wEl(doc, 'tblGrid'));
        for (let c = 0; c < spec.columns; c++) {
            grid.appendChild(text.wEl(doc, 'gridCol', { w: cellWidth }));
        }
        spec.rows.forEach((row, r) => tbl.appendChild(tableRow(doc, { row, first: r === 0, spec, cellWidth })));
        return tbl;
    }
}
function tableProperties(doc, spec) {
    const tblPr = text.wEl(doc, 'tblPr');
    if (spec.styleId) {
        tblPr.appendChild(text.wEl(doc, 'tblStyle', { val: spec.styleId }));
    }
    tblPr.appendChild(text.wEl(doc, 'tblW', { w: 0, type: 'auto' }));
    if (!spec.styleId) {
        tblPr.appendChild(borders(doc));
    }
    tblPr.appendChild(text.wEl(doc, 'tblLook', {
        val: '04A0',
        firstRow: spec.header ? 1 : 0,
        lastRow: 0,
        firstColumn: 1,
        lastColumn: 0,
        noHBand: 0,
        noVBand: 1
    }));
    return tblPr;
}
function tableRow(doc, build) {
    const headerRow = build.spec.header && build.first;
    const tr = text.wEl(doc, 'tr');
    if (headerRow) {
        xml.append(tr, text.wEl(doc, 'trPr')).appendChild(text.wEl(doc, 'tblHeader'));
    }
    for (let c = 0; c < build.spec.columns; c++) {
        const tc = xml.append(tr, text.wEl(doc, 'tc'));
        xml
            .append(tc, text.wEl(doc, 'tcPr'))
            .appendChild(text.wEl(doc, 'tcW', { w: build.cellWidth, type: 'dxa' }));
        const value = cellText(build.row[c]);
        tc.appendChild(text.buildParagraph(doc, headerRow ? { runs: [{ text: value, bold: true }] } : value, null));
    }
    return tr;
}
function fillCell(tc, value) {
    const tcPr = xml.child(tc, W, 'tcPr');
    for (const v of tcPr ? xml.children(tcPr, W, 'vMerge') : []) {
        xml.remove(v);
    }
    text.replaceContent(clearCell(tc), value);
}
function checkMerge(tc, ref) {
    const tcPr = xml.child(tc, W, 'tcPr');
    const vMerge = tcPr ? xml.child(tcPr, W, 'vMerge') : null;
    if (vMerge && text.wGet(vMerge, 'val') !== 'restart') {
        throw new DocsError('CELL_MERGED', `cell ${ref.row},${ref.column} is covered by a merged cell above it; write that cell instead`);
    }
    return tc;
}
function headerParagraphs(value, kind) {
    if (typeof value === 'string') {
        return value.split('\n');
    }
    if (Array.isArray(value) && value.length)
        return value;
    throw new DocsError('INVALID_TEXT', `${kind} text must be a string or an array of paragraphs`);
}
function headerType(opts) {
    const type = opts.type ?? 'default';
    if (type !== 'default' && type !== 'first') {
        throw new DocsError('INVALID_OPTIONS', 'type must be "default" or "first"');
    }
    return type;
}
function tableRows(el) {
    return unwrapped(el, 'tr').map((tr) => unwrapped(tr, 'tc').map((tc) => xml
        .children(tc, W)
        .filter((n) => CELL_BLOCKS.has(n.localName ?? ''))
        .map(text.blockText)
        .join('\n')));
}
function listLevel(el) {
    const pPr = xml.child(el, W, 'pPr');
    const numPr = pPr ? xml.child(pPr, W, 'numPr') : null;
    const ilvl = numPr ? xml.child(numPr, W, 'ilvl') : null;
    return ilvl ? Number(text.wGet(ilvl, 'val')) : 0;
}
function describeExtras(el, out) {
    const footnotes = xml.descendants(el, W, 'footnoteReference').map((r) => text.wGet(r, 'id'));
    if (footnotes.length) {
        out.footnotes = footnotes;
    }
    const anchors = [
        ...xml.descendants(el, W, 'commentRangeStart'),
        ...xml.descendants(el, W, 'commentReference')
    ];
    const comments = [...new Set(anchors.map((r) => text.wGet(r, 'id')))];
    if (comments.length) {
        out.comments = comments;
    }
    const pictures = xml.descendants(el, PIC, 'pic').length;
    if (pictures) {
        out.images = pictures;
    }
}
