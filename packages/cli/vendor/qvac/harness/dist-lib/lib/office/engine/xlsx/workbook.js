import { Package } from '../opc/package.js';
import * as xml from '../xml.js';
import * as media from '../opc/media.js';
import { probe } from '../image.js';
import { points } from '../units.js';
import * as refs from './refs.js';
import * as formula from './formula.js';
import { Sheet, SHEET_ORDER } from './sheet.js';
import { SharedStrings } from './strings.js';
import { Styles, validate as validateStyle } from './styles.js';
import * as properties from '../opc/properties.js';
import * as chart from '../drawingml/chart.js';
import * as reshape from './reshape.js';
import { build } from './template.js';
import { DocsError } from '../errors.js';
import { isRecord } from '../../../guards.js';
const { x: X, r: R, xdr: XDR, a: A } = xml.ns;
const STRICT_REL = 'http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument';
const REL_BASE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const REL = {
    officeDocument: REL_BASE + 'officeDocument',
    worksheet: REL_BASE + 'worksheet',
    calcChain: REL_BASE + 'calcChain',
    drawing: REL_BASE + 'drawing',
    chart: REL_BASE + 'chart',
    vbaProject: 'http://schemas.microsoft.com/office/2006/relationships/vbaProject'
};
const SML = 'application/vnd.openxmlformats-officedocument.spreadsheetml.';
const TYPES = {
    main: SML + 'sheet.main+xml',
    worksheet: SML + 'worksheet+xml',
    drawing: 'application/vnd.openxmlformats-officedocument.drawing+xml',
    chart: 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml'
};
const MACRO_TYPES = new Set([
    'application/vnd.ms-excel.sheet.macroEnabled.main+xml',
    'application/vnd.ms-excel.template.macroEnabled.main+xml'
]);
const MAIN_TYPES = new Set([TYPES.main, SML + 'template.main+xml', ...MACRO_TYPES]);
const WORKBOOK_ORDER = [
    'fileVersion',
    'fileSharing',
    'workbookPr',
    'workbookProtection',
    'bookViews',
    'sheets',
    'functionGroups',
    'externalReferences',
    'definedNames',
    'calcPr',
    'oleSize',
    'customWorkbookViews',
    'pivotCaches',
    'smartTagPr',
    'smartTagTypes',
    'webPublishing',
    'fileRecoveryPr',
    'webPublishObjects',
    'extLst'
];
const EMU_PER_PIXEL = 9525;
function validateRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0 || !rows.every((row) => Array.isArray(row))) {
        throw new DocsError('INVALID_VALUE', 'rows must be a non-empty array of rows, each an array of values');
    }
    if (rows.length > 100000) {
        throw new DocsError('INVALID_VALUE', 'add at most 100000 rows at a time');
    }
    return rows.filter((row) => Array.isArray(row));
}
function options(opts, name) {
    if (!isRecord(opts) || Array.isArray(opts)) {
        throw new DocsError('INVALID_OPTIONS', `${name} takes an options object`);
    }
    return opts;
}
function positiveCount(value) {
    const count = value === undefined ? 1 : value;
    if (!(typeof count === 'number' && Number.isInteger(count) && count >= 1)) {
        throw new DocsError('INVALID_VALUE', 'count must be at least 1');
    }
    return count;
}
function emu(opts, key) {
    const value = opts[key];
    if (value === undefined) {
        return undefined;
    }
    if (!(typeof value === 'number' && Number.isInteger(value) && value > 0)) {
        throw new DocsError('INVALID_BOX', `${key} must be a positive whole number of EMU, got ${String(value)}`);
    }
    return value;
}
function imageSize(opts, native) {
    const width = emu(opts, 'width');
    const height = emu(opts, 'height');
    const ratio = native.height / native.width;
    if (width === undefined && height === undefined) {
        return { width: native.width * EMU_PER_PIXEL, height: native.height * EMU_PER_PIXEL };
    }
    if (width !== undefined && height !== undefined) {
        return { width, height };
    }
    if (width !== undefined) {
        return { width, height: Math.round(width * ratio) };
    }
    return { width: Math.round((height ?? 0) / ratio), height: height ?? 0 };
}
function categoryValue(v) {
    if (typeof v === 'number')
        return v;
    return v === null ? '' : String(v);
}
function sheetName(raw) {
    return raw.startsWith("'") && raw.endsWith("'") ? raw.slice(1, -1).replace(/''/g, "'") : raw;
}
function anchorStart(doc, anchor) {
    const d = xml.builder(doc, XDR);
    const text = (local, value) => {
        const el = d(local);
        xml.setText(el, String(value));
        return el;
    };
    const root = d('oneCellAnchor');
    const from = xml.append(root, d('from'));
    from.appendChild(text('col', anchor.at.col));
    from.appendChild(text('colOff', 0));
    from.appendChild(text('row', anchor.at.row));
    from.appendChild(text('rowOff', 0));
    root.appendChild(d('ext', { cx: anchor.size.width, cy: anchor.size.height }));
    return root;
}
function xfrmOf(parent, spec) {
    const doc = xml.owner(parent);
    const a = xml.builder(doc, A);
    const size = spec.size;
    const xfrm = xml.append(parent, xml.builder(doc, spec.namespace)('xfrm'));
    xfrm.appendChild(a('off', { x: 0, y: 0 }));
    xfrm.appendChild(a('ext', { cx: size.width, cy: size.height }));
}
function chartAnchor(doc, anchor, spec) {
    const d = xml.builder(doc, XDR);
    const a = xml.builder(doc, A);
    const root = anchorStart(doc, anchor);
    const frame = xml.append(root, d('graphicFrame', { macro: '' }));
    const nv = xml.append(frame, d('nvGraphicFramePr'));
    nv.appendChild(d('cNvPr', { id: spec.id, name: spec.name }));
    nv.appendChild(d('cNvGraphicFramePr'));
    xfrmOf(frame, { namespace: XDR, size: { width: 0, height: 0 } });
    const data = xml.append(xml.append(frame, a('graphic')), a('graphicData', { uri: chart.GRAPHIC_URI }));
    const ref = xml.append(data, xml.builder(doc, chart.C)('chart'));
    xml.setNsAttribute(ref, { namespace: R, local: 'id' }, spec.rId);
    root.appendChild(d('clientData'));
    return root;
}
function pictureAnchor(doc, anchor, spec) {
    const d = xml.builder(doc, XDR);
    const a = xml.builder(doc, A);
    const root = anchorStart(doc, anchor);
    const pic = xml.append(root, d('pic'));
    const nv = xml.append(pic, d('nvPicPr'));
    nv.appendChild(d('cNvPr', { id: spec.id, name: spec.name, descr: spec.description }));
    xml.append(nv, d('cNvPicPr')).appendChild(a('picLocks', { noChangeAspect: 1 }));
    const fill = xml.append(pic, d('blipFill'));
    const blip = xml.append(fill, a('blip'));
    xml.setNsAttribute(blip, { namespace: R, local: 'embed' }, spec.rId);
    xml.append(fill, a('stretch')).appendChild(a('fillRect'));
    const spPr = xml.append(pic, d('spPr'));
    xfrmOf(spPr, { namespace: A, size: spec.size });
    xml.append(spPr, a('prstGeom', { prst: 'rect' })).appendChild(a('avLst'));
    root.appendChild(d('clientData'));
    return root;
}
function markerCell(marker) {
    return {
        row: Number(xml.text(xml.child(marker, XDR, 'row'))),
        col: Number(xml.text(xml.child(marker, XDR, 'col')))
    };
}
function nextDrawingId(doc) {
    return (Math.max(0, ...xml.descendants(doc, XDR, 'cNvPr').map((el) => Number(el.getAttribute('id')) || 0)) + 1);
}
export class Workbook {
    package;
    main;
    strings;
    styles;
    state;
    sheetsChanged;
    constructor(pkg) {
        this.package = pkg;
        const main = pkg.related('/', REL.officeDocument)[0];
        if (!main || !MAIN_TYPES.has(pkg.contentType(main) ?? '')) {
            if (pkg.rels('/').byType(STRICT_REL).length) {
                throw new DocsError('UNSUPPORTED_XLSX', 'the workbook uses Strict Open XML, which is not supported');
            }
            throw new DocsError('NOT_XLSX', 'the file is not an Excel workbook');
        }
        this.main = main;
        const root = pkg.root(main);
        if (root.namespaceURI !== X || root.localName !== 'workbook') {
            throw new DocsError('UNSUPPORTED_XLSX', 'the workbook uses Strict Open XML, which is not supported');
        }
        this.strings = new SharedStrings(pkg, main);
        this.styles = new Styles(pkg, main);
        this.state = { touched: new Set(), formulas: false, cellsChanged: false };
        this.sheetsChanged = false;
    }
    static open(bytes, opts) {
        return new Workbook(Package.open(bytes, opts));
    }
    static create(opts = {}) {
        const pkg = Package.create({ strict: opts.strict });
        build(pkg, opts);
        return new Workbook(pkg);
    }
    get changed() {
        return this.package.changed;
    }
    get date1904() {
        const value = xml.child(this.root(), X, 'workbookPr')?.getAttribute('date1904');
        return value === '1' || value === 'true';
    }
    get hasMacros() {
        return MACRO_TYPES.has(this.package.contentType(this.main) ?? '');
    }
    sheets() {
        return this.entries().map((entry) => {
            const out = {
                index: entry.index,
                name: entry.name,
                kind: entry.kind,
                state: entry.state
            };
            if (entry.kind === 'worksheet') {
                const used = new Sheet(this, entry).usedRange();
                out.range = used ? refs.range(used) : null;
            }
            return out;
        });
    }
    read(sheet, opts) {
        const target = this.sheet(sheet);
        const out = target.read(isRecord(opts) ? opts : {});
        const charts = this.charts(target);
        if (charts.length) {
            out.charts = charts;
        }
        return out;
    }
    get(sheet, ref) {
        return this.sheet(sheet).get(ref);
    }
    setCells(sheet, cells) {
        const target = this.sheet(sheet);
        if (!isRecord(cells) || Array.isArray(cells) || !Object.keys(cells).length) {
            throw new DocsError('INVALID_VALUE', 'cells must be an object like { "A1": "Name", "B2": 42 }');
        }
        for (const ref of Object.keys(cells)) {
            refs.parse(ref);
        }
        for (const [ref, value] of Object.entries(cells)) {
            target.write(ref, value);
        }
        return { cells: Object.keys(cells).length };
    }
    format(sheet, range, style) {
        const target = this.sheet(sheet);
        const area = refs.parseRange(range);
        const count = (area.bottom - area.top + 1) * (area.right - area.left + 1);
        if (count > 100000) {
            throw new DocsError('INVALID_RANGE', `format at most 100000 cells at a time, got ${count}`);
        }
        if (!isRecord(style) || Array.isArray(style) || !Object.keys(style).length) {
            throw new DocsError('INVALID_STYLE', 'style must name something to change, like { bold: true }');
        }
        validateStyle(style);
        for (let row = area.top; row <= area.bottom; row++) {
            for (let col = area.left; col <= area.right; col++) {
                target.write(refs.cell(row, col), style);
            }
        }
        return { cells: count };
    }
    appendRows(sheet, rows) {
        const target = this.sheet(sheet);
        const list = validateRows(rows);
        const start = target.lastRow() + 1;
        this.writeRows(target, { start, rows: list });
        return { from: start + 1, to: start + list.length };
    }
    insertRows(sheet, opts) {
        const target = this.sheet(sheet);
        const o = options(opts, 'insertRows');
        const row = refs.rowArg(o.at, 'at');
        if ((o.rows === undefined) === (o.count === undefined)) {
            throw new DocsError('INVALID_VALUE', 'give the rows to insert, or how many empty rows');
        }
        const list = o.rows === undefined ? null : validateRows(o.rows);
        const count = list ? list.length : o.count;
        if (!(typeof count === 'number' && Number.isInteger(count) && count >= 1)) {
            throw new DocsError('INVALID_VALUE', 'give the rows to insert, or how many empty rows');
        }
        const change = { sheet: target.name, axis: 'row', at: row, count, kind: 'insert' };
        this.reshapeWith(target, { change, action: 'insert rows' }, () => target.shiftRows(row, count));
        if (list) {
            this.writeRows(target, { start: row, rows: list, styleFrom: row + count });
        }
        return { from: row + 1, to: row + count };
    }
    deleteRows(sheet, opts) {
        const target = this.sheet(sheet);
        const o = options(opts, 'deleteRows');
        const row = refs.rowArg(o.at, 'at');
        const count = positiveCount(o.count);
        const change = { sheet: target.name, axis: 'row', at: row, count, kind: 'delete' };
        this.reshapeWith(target, { change, action: 'delete rows' }, () => target.removeRows(row, count));
        return { deleted: count };
    }
    deleteColumns(sheet, opts) {
        const target = this.sheet(sheet);
        const o = options(opts, 'deleteColumns');
        const col = refs.columnArg(o.column);
        const count = positiveCount(o.count);
        const change = { sheet: target.name, axis: 'col', at: col, count, kind: 'delete' };
        this.reshapeWith(target, { change, action: 'delete columns' }, () => target.removeColumns(col, count));
        return { deleted: count };
    }
    setColumnWidth(sheet, opts) {
        const target = this.sheet(sheet);
        const o = options(opts, 'setColumnWidth');
        const col = refs.columnArg(o.column);
        const width = o.width;
        if (!(typeof width === 'number' && width > 0 && width <= 255)) {
            throw new DocsError('INVALID_VALUE', `width is in characters, from 0 to 255, got ${String(width)}`);
        }
        target.setColumnWidth({ col, width });
        return { changed: true };
    }
    addSheet(name, opts = {}) {
        const valid = this.validateName(name, null);
        const entries = this.entries();
        const at = isRecord(opts) && opts.at !== undefined ? opts.at : entries.length;
        if (!(typeof at === 'number' && Number.isInteger(at) && at >= 0 && at <= entries.length)) {
            throw new DocsError('SHEET_NOT_FOUND', `at must be a position from 0 to ${entries.length}, got ${String(at)}`);
        }
        const pkg = this.package;
        const part = pkg.freeName('/xl/worksheets/sheet%d.xml');
        pkg.add(part, xml.parse(`<worksheet xmlns="${X}" xmlns:r="${R}"><sheetData/></worksheet>`), TYPES.worksheet);
        const rId = pkg.rels(this.main).add(REL.worksheet, part);
        const sheetId = Math.max(0, ...entries.map((e) => Number(e.el.getAttribute('sheetId')))) + 1;
        const el = xml.setAttributes(xml.named(this.doc(), 'sheet', X), { name: valid, sheetId });
        xml.setNsAttribute(el, { namespace: R, local: 'id' }, rId);
        this.sheetList().insertBefore(el, entries[at]?.el ?? null);
        this.shiftSheetIndexes(at, 1);
        pkg.touch(this.main);
        this.sheetsChanged = true;
        return { index: at, name: valid };
    }
    renameSheet(sheet, name) {
        const entry = this.entry(sheet);
        if (entry.name === name) {
            return { changed: false };
        }
        const to = this.validateName(name, entry);
        const from = entry.name;
        entry.el.setAttribute('name', to);
        this.package.touch(this.main);
        this.sheetsChanged = true;
        return { changed: true, formulas: this.renameReferences(from, to) };
    }
    renameReferences(from, to) {
        let updated = 0;
        const rewrite = (el) => {
            const next = formula.renameSheet(xml.text(el), { from, to });
            if (next === xml.text(el)) {
                return false;
            }
            xml.setText(el, next);
            updated++;
            return true;
        };
        for (const other of this.entries().filter((e) => e.kind === 'worksheet')) {
            if (this.rewriteAll(reshape.formulaElements(this.package.xml(other.part)), rewrite)) {
                this.package.touch(other.part);
            }
        }
        for (const dn of this.definedNames()) {
            rewrite(dn);
        }
        for (const part of this.chartParts()) {
            if (this.rewriteAll(xml.descendants(this.package.xml(part), xml.ns.c, 'f'), rewrite)) {
                this.package.touch(part);
            }
        }
        reshape.renamePivotSources(this.package, from, to);
        return updated;
    }
    deleteSheet(sheet) {
        const entry = this.entry(sheet);
        const visible = this.entries().filter((e) => e.state === 'visible' && e.part !== entry.part);
        if (visible.length === 0) {
            throw new DocsError('LAST_SHEET', `"${entry.name}" is the only visible sheet; a workbook needs at least one`);
        }
        const users = this.references(entry, { includeOwn: false });
        if (users.length) {
            throw new DocsError('SHEET_IS_REFERENCED', `"${entry.name}" is used by ${users.join(', ')}; those would turn into #REF! errors, so change them first`);
        }
        for (const dn of this.definedNames()) {
            const local = dn.getAttribute('localSheetId');
            if (local !== null && local !== '' && Number(local) === entry.index) {
                xml.remove(dn);
            }
        }
        this.shiftSheetIndexes(entry.index + 1, -1);
        xml.remove(entry.el);
        this.package.rels(this.main).remove(entry.rId);
        this.package.remove(entry.part);
        const names = xml.child(this.root(), X, 'definedNames');
        if (names && !xml.children(names, X, 'definedName').length) {
            xml.remove(names);
        }
        this.package.touch(this.main);
        this.sheetsChanged = true;
        return { sheets: this.entries().length };
    }
    addImage(sheet, bytes, opts = {}) {
        const target = this.sheet(sheet);
        const info = probe(bytes);
        const o = isRecord(opts) ? opts : {};
        const at = o.cell === undefined ? this.besideData(target) : refs.parse(o.cell);
        const size = imageSize(o, info);
        const drawing = this.ensureDrawing(target);
        const { rId } = media.addImage(this.package, bytes, { source: drawing, dir: '../media' });
        const doc = this.package.xml(drawing);
        const id = nextDrawingId(doc);
        const name = typeof o.name === 'string' && o.name ? o.name : `Picture ${id}`;
        const description = typeof o.description === 'string' ? o.description : undefined;
        xml
            .root(doc)
            .appendChild(pictureAnchor(doc, { at, size }, { id, rId, name, description, size }));
        this.package.touch(drawing);
        return { cell: refs.cell(at.row, at.col), ...size };
    }
    addChart(sheet, input) {
        const target = this.sheet(sheet);
        const spec = isRecord(input) ? input : {};
        if (typeof spec.categories !== 'string') {
            throw new DocsError('INVALID_CHART_DATA', 'categories must be a range like "A2:A5"');
        }
        if (!Array.isArray(spec.series) || spec.series.length === 0) {
            throw new DocsError('INVALID_CHART_DATA', 'series must be a non-empty array of { values: "B2:B5", name }');
        }
        const categories = this.rangeValues(target, spec.categories);
        const series = spec.series.map((s, i) => this.planSeries(target, { s, i, count: categories.values.length }));
        const at = spec.cell === undefined ? this.besideData(target) : refs.parse(spec.cell);
        const width = emu(spec, 'width') ?? 5486400;
        const height = emu(spec, 'height') ?? 3200400;
        const pkg = this.package;
        const part = pkg.freeName('/xl/charts/chart%d.xml');
        chart.createChart({ pkg, part }, {
            type: spec.type,
            title: spec.title,
            stacked: spec.stacked,
            legend: spec.legend,
            categories: categories.values.map(categoryValue),
            series: series.map(({ name, values }) => ({ name, values }))
        }, { links: { categories: categories.formula, series: series.map((s) => s.link) } });
        this.placeChart(target, { part, anchor: { at, size: { width, height } }, name: spec.name });
        return { cell: refs.cell(at.row, at.col), width, height };
    }
    removeMacros() {
        if (!this.hasMacros) {
            return { changed: false };
        }
        this.package.contentTypes.setOverride(this.main, TYPES.main);
        for (const part of this.package.related(this.main, REL.vbaProject)) {
            this.package.remove(part);
        }
        const rels = this.package.rels(this.main);
        for (const rel of rels.byType(REL.vbaProject)) {
            rels.remove(rel.id);
        }
        return { changed: true };
    }
    save(opts) {
        for (const sheet of this.state.touched) {
            if (this.package.has(sheet.part)) {
                sheet.updateDimension();
            }
        }
        if (this.state.cellsChanged) {
            this.dropCalcChain();
        }
        if (this.state.formulas) {
            this.requestRecalc();
        }
        if (this.sheetsChanged) {
            properties.refreshSummary(this.package);
            this.sheetsChanged = false;
        }
        properties.applySaveOptions(this.package, opts);
        this.state.touched.clear();
        this.state.cellsChanged = false;
        this.state.formulas = false;
        return this.package.save();
    }
    host() {
        return {
            package: this.package,
            main: this.main,
            state: this.state,
            entries: () => this.entries(),
            definedNames: () => this.definedNames(),
            chartParts: () => this.chartParts(),
            drawingOf: (sheet) => this.drawingOf(sheet),
            sheetFor: (entry) => new Sheet(this, entry)
        };
    }
    reshapeWith(target, step, move) {
        const host = this.host();
        const reasons = reshape.blockers(host, target, step.change);
        if (reasons.length) {
            const fallback = step.action === 'insert rows'
                ? 'append the rows at the end instead'
                : 'clear the cells instead';
            throw new DocsError('SHEET_HAS_DEPENDENTS', `cannot ${step.action} on "${target.name}": it has ${reasons.join(', ')}, which cannot be moved yet; ${fallback}`);
        }
        reshape.prepare(host, target);
        move();
        reshape.apply(host, target, step.change);
    }
    rewriteAll(els, rewrite) {
        let touched = false;
        for (const el of els) {
            if (rewrite(el)) {
                touched = true;
            }
        }
        return touched;
    }
    dropCalcChain() {
        const rels = this.package.rels(this.main);
        for (const rel of rels.byType(REL.calcChain)) {
            if (rel.part && this.package.has(rel.part)) {
                this.package.remove(rel.part);
            }
            rels.remove(rel.id);
        }
    }
    requestRecalc() {
        const root = this.root();
        const calc = xml.child(root, X, 'calcPr') ??
            xml.insertOrdered(root, xml.named(this.doc(), 'calcPr', X), WORKBOOK_ORDER);
        if (calc.getAttribute('fullCalcOnLoad') === '1') {
            return;
        }
        calc.setAttribute('fullCalcOnLoad', '1');
        this.package.touch(this.main);
    }
    planSeries(target, item) {
        const { s, i, count } = item;
        if (!isRecord(s) || typeof s.values !== 'string') {
            throw new DocsError('INVALID_CHART_DATA', `series ${i} needs values as a range like "B2:B5"`);
        }
        const values = this.rangeValues(target, s.values);
        if (values.values.length !== count) {
            throw new DocsError('INVALID_CHART_DATA', `series ${i} covers ${values.values.length} cells but the categories cover ${count}`);
        }
        const { name, nameRef } = this.seriesName(target, s, i);
        return {
            name,
            values: values.values.map((v) => (typeof v === 'number' ? v : null)),
            link: { name: nameRef, values: values.formula }
        };
    }
    seriesName(target, s, i) {
        let name = s.name;
        let nameRef = null;
        if (s.nameCell !== undefined) {
            const cell = this.rangeValues(target, s.nameCell);
            if (cell.values.length !== 1) {
                throw new DocsError('INVALID_CHART_DATA', `nameCell of series ${i} must be one cell`);
            }
            nameRef = cell.formula;
            if (name === undefined) {
                name = cell.values[0] === null ? '' : String(cell.values[0]);
            }
        }
        if (name === undefined) {
            name = `Series ${i + 1}`;
        }
        if (typeof name !== 'string') {
            throw new DocsError('INVALID_CHART_DATA', `series ${i} name must be text`);
        }
        return { name, nameRef };
    }
    placeChart(target, place) {
        const drawing = this.ensureDrawing(target);
        const rId = this.package.rels(drawing).add(REL.chart, place.part);
        const doc = this.package.xml(drawing);
        const id = nextDrawingId(doc);
        const name = typeof place.name === 'string' && place.name ? place.name : `Chart ${id}`;
        xml.root(doc).appendChild(chartAnchor(doc, place.anchor, { id, rId, name }));
        this.package.touch(drawing);
    }
    doc() {
        return this.package.xml(this.main);
    }
    root() {
        return xml.root(this.doc());
    }
    sheetList() {
        const list = xml.child(this.root(), X, 'sheets');
        if (!list) {
            throw new DocsError('BROKEN_XLSX', 'the workbook lists no sheets');
        }
        return list;
    }
    entries() {
        const rels = this.package.rels(this.main);
        return xml.children(this.sheetList(), X, 'sheet').map((el, index) => {
            const rId = el.getAttributeNS(R, 'id') ?? '';
            const rel = rels.get(rId);
            if (!rel || rel.external || !rel.part || !this.package.has(rel.part)) {
                throw new DocsError('BROKEN_XLSX', `sheet "${xml.attr(el, 'name')}" points at a missing part`);
            }
            return {
                el,
                index,
                rId,
                name: el.getAttribute('name') || '',
                state: el.getAttribute('state') || 'visible',
                part: rel.part,
                kind: rel.type === REL.worksheet
                    ? 'worksheet'
                    : (rel.type || 'unknown').split('/').pop() || 'unknown'
            };
        });
    }
    entry(ref) {
        const entries = this.entries();
        let found;
        if (typeof ref === 'number') {
            found = entries[ref];
        }
        else if (typeof ref === 'string') {
            found = entries.find((e) => e.name.toLowerCase() === ref.toLowerCase());
        }
        if (!found) {
            throw new DocsError('SHEET_NOT_FOUND', `no sheet ${JSON.stringify(ref)}; the workbook has ${entries.map((e) => `${e.index} "${e.name}"`).join(', ')}`);
        }
        return found;
    }
    sheet(ref) {
        const entry = this.entry(ref);
        if (entry.kind !== 'worksheet') {
            throw new DocsError('NOT_WORKSHEET', `"${entry.name}" is a ${entry.kind}, not a worksheet`);
        }
        return new Sheet(this, entry);
    }
    validateName(name, self) {
        if (typeof name !== 'string' || name.length < 1 || name.length > 31) {
            throw new DocsError('INVALID_NAME', 'a sheet name is 1 to 31 characters');
        }
        if (/[:\\/?*[\]]/.test(name) || name.startsWith("'") || name.endsWith("'")) {
            throw new DocsError('INVALID_NAME', 'a sheet name cannot contain : \\ / ? * [ ] or start or end with an apostrophe');
        }
        if (name.toLowerCase() === 'history') {
            throw new DocsError('INVALID_NAME', '"History" is reserved by Excel');
        }
        const clash = this.entries().find((e) => (!self || e.part !== self.part) && e.name.toLowerCase() === name.toLowerCase());
        if (clash) {
            throw new DocsError('INVALID_NAME', `the workbook already has a sheet named "${clash.name}"`);
        }
        return name;
    }
    definedNames() {
        const names = xml.child(this.root(), X, 'definedNames');
        return names ? xml.children(names, X, 'definedName') : [];
    }
    chartParts() {
        return this.package.names().filter((name) => this.package.contentType(name) === TYPES.chart);
    }
    formulaUsers(entry, query) {
        const { includeOwn } = query;
        const users = [];
        for (const other of this.entries().filter((e) => e.kind === 'worksheet')) {
            const texts = reshape.formulaElements(this.package.xml(other.part)).map((el) => xml.text(el));
            if (other.part === entry.part) {
                if (includeOwn && texts.length) {
                    users.push('formulas on this sheet');
                }
                continue;
            }
            if (texts.some((t) => formula.mentions(t, entry.name))) {
                users.push(`formulas on "${other.name}"`);
            }
        }
        return users;
    }
    tableUsers(entry) {
        const tables = reshape.tableNames(this.package, entry.part);
        if (!tables.length) {
            return [];
        }
        const uses = (text) => tables.some((table) => formula.usesTable(text, table));
        const users = [];
        for (const other of this.entries().filter((e) => e.kind === 'worksheet')) {
            if (other.part === entry.part) {
                continue;
            }
            if (reshape.formulaElements(this.package.xml(other.part)).some((el) => uses(xml.text(el)))) {
                users.push(`formulas on "${other.name}" that use table ${tables.join(', ')}`);
            }
        }
        const names = this.definedNames().filter((dn) => uses(xml.text(dn)));
        if (names.length) {
            users.push(`defined names ${names.map((dn) => xml.attr(dn, 'name')).join(', ')}`);
        }
        return users;
    }
    references(entry, query) {
        const { includeOwn } = query;
        const users = this.formulaUsers(entry, query);
        if (!includeOwn) {
            users.push(...this.tableUsers(entry));
        }
        const names = this.definedNames().filter((dn) => {
            const local = dn.getAttribute('localSheetId');
            const own = local !== null && local !== '' && Number(local) === entry.index;
            return (!own || includeOwn) && formula.mentions(xml.text(dn), entry.name);
        });
        if (names.length) {
            users.push(`defined names ${names.map((dn) => xml.attr(dn, 'name')).join(', ')}`);
        }
        const own = includeOwn ? new Set() : new Set(this.ownCharts(entry));
        const charts = this.chartParts().filter((part) => !own.has(part) &&
            xml
                .descendants(this.package.xml(part), xml.ns.c, 'f')
                .some((f) => formula.mentions(xml.text(f), entry.name)));
        if (charts.length) {
            users.push(`${charts.length} chart(s)`);
        }
        return users;
    }
    writeRows(target, write) {
        write.rows.forEach((row, i) => {
            row.forEach((value, col) => {
                if (value === null || value === undefined)
                    return;
                const r = write.start + i;
                target.write(refs.cell(r, col), value);
                if (write.styleFrom === undefined) {
                    return;
                }
                const s = target.findCell({ row: write.styleFrom, col })?.getAttribute('s');
                if (s) {
                    target.findCell({ row: r, col })?.setAttribute('s', s);
                }
            });
        });
    }
    shiftSheetIndexes(from, delta) {
        for (const dn of this.definedNames()) {
            const local = dn.getAttribute('localSheetId');
            if (local !== null && local !== '' && Number(local) >= from) {
                dn.setAttribute('localSheetId', String(Number(local) + delta));
            }
        }
        const views = xml.child(this.root(), X, 'bookViews');
        const count = this.entries().length + (delta < 0 ? -1 : 0);
        for (const view of views ? xml.children(views, X, 'workbookView') : []) {
            for (const attr of ['activeTab', 'firstSheet']) {
                if (!view.hasAttribute(attr))
                    continue;
                let n = Number(view.getAttribute(attr));
                if (n >= from) {
                    n += delta;
                }
                view.setAttribute(attr, String(Math.max(0, Math.min(n, count - 1))));
            }
        }
    }
    charts(sheet) {
        const drawing = this.drawingOf(sheet);
        if (!drawing) {
            return [];
        }
        const rels = this.package.rels(drawing);
        const out = [];
        for (const anchor of xml.children(this.package.root(drawing), XDR)) {
            const ref = xml.descendants(anchor, xml.ns.c, 'chart')[0];
            const rel = ref ? rels.get(ref.getAttributeNS(R, 'id')) : null;
            if (!rel || rel.external || !rel.part || !this.package.has(rel.part)) {
                continue;
            }
            const from = xml.child(anchor, XDR, 'from');
            const info = chart.readChart(this.package.xml(rel.part));
            if (from) {
                const { row, col } = markerCell(from);
                info.cell = refs.cell(row, col);
            }
            out.push(info);
        }
        return out;
    }
    ownCharts(entry) {
        const drawing = this.drawingOf(new Sheet(this, entry));
        return drawing ? this.package.related(drawing, REL.chart) : [];
    }
    rangeValues(defaultSheet, ref) {
        if (typeof ref !== 'string') {
            throw new DocsError('INVALID_RANGE', 'a range is text like A2:A5 or Sales!B2:B5');
        }
        const bang = ref.lastIndexOf('!');
        const sheet = bang === -1 ? defaultSheet : this.sheet(sheetName(ref.slice(0, bang)));
        const area = refs.parseRange((bang === -1 ? ref : ref.slice(bang + 1)).replace(/\$/g, ''));
        if (area.top !== area.bottom && area.left !== area.right) {
            throw new DocsError('INVALID_RANGE', `${ref} must be a single row or a single column`);
        }
        const byPos = new Map(sheet.cells().map(({ el, row, col }) => [`${row}:${col}`, el]));
        const values = [];
        for (let row = area.top; row <= area.bottom; row++) {
            for (let col = area.left; col <= area.right; col++) {
                const el = byPos.get(`${row}:${col}`);
                values.push(el ? sheet.value(el) : null);
            }
        }
        return { values, formula: refs.absolute(sheet.name, area) };
    }
    besideData(sheet) {
        const used = sheet.usedRange();
        const col = used ? used.right + 2 : 0;
        return { row: Math.max(used ? used.top : 0, ...this.rowsBelowDrawings(sheet, col)), col };
    }
    rowsBelowDrawings(sheet, col) {
        const drawing = this.drawingOf(sheet);
        if (!drawing) {
            return [];
        }
        const format = xml.child(sheet.root, X, 'sheetFormatPr');
        const rowHeight = points(Number(format?.getAttribute('defaultRowHeight') ?? 15));
        return xml.children(this.package.root(drawing), XDR).flatMap((anchor) => {
            const from = xml.child(anchor, XDR, 'from');
            if (!from || markerCell(from).col !== col) {
                return [];
            }
            const to = xml.child(anchor, XDR, 'to');
            if (to) {
                return [markerCell(to).row + 2];
            }
            const ext = xml.child(anchor, XDR, 'ext');
            return ext
                ? [markerCell(from).row + Math.ceil(Number(ext.getAttribute('cy')) / rowHeight) + 1]
                : [];
        });
    }
    drawingOf(sheet) {
        const ref = xml.child(sheet.root, X, 'drawing');
        if (!ref) {
            return null;
        }
        const rel = this.package.rels(sheet.part).get(ref.getAttributeNS(R, 'id'));
        return rel && !rel.external && rel.part && this.package.has(rel.part) ? rel.part : null;
    }
    ensureDrawing(sheet) {
        const existing = this.drawingOf(sheet);
        if (existing) {
            return existing;
        }
        const part = this.package.freeName('/xl/drawings/drawing%d.xml');
        this.package.add(part, xml.parse(`<xdr:wsDr xmlns:xdr="${XDR}" xmlns:a="${A}" xmlns:r="${R}"/>`), TYPES.drawing);
        const rId = this.package.rels(sheet.part).add(REL.drawing, part);
        const el = xml.named(sheet.doc, 'drawing', X);
        xml.setNsAttribute(el, { namespace: R, local: 'id' }, rId);
        xml.insertOrdered(sheet.root, el, SHEET_ORDER);
        sheet.touch();
        return part;
    }
}
