const TABLE_INDEX = { index: 'table' };
const BOX = ['x', 'y', 'width', 'height'];
const CHART = ['type', 'categories', 'series', 'title', 'stacked', 'legend', 'name'];
export const PPTX_OPS = {
    read: { slots: [], query: true },
    layouts: { slots: [], query: true },
    setText: { slots: [['slide', 'shape'], 'text'] },
    setCellText: { slots: [['slide', 'shape', 'row', 'column'], 'text'] },
    setStyle: { slots: [['slide', 'shape'], 'style', ['paragraph']] },
    addSlide: { slots: [['like', 'layout', 'at', 'title', 'body', 'image']] },
    addPicture: { slots: ['slide', 'image', [...BOX, 'name', 'description']], inches: true },
    addTextBox: { slots: ['slide', [...BOX, 'text', 'style', 'fill', 'name']], inches: true },
    addTable: { slots: ['slide', [...BOX, 'rows', 'header', 'name']], inches: true },
    addChart: { slots: ['slide', [...BOX, ...CHART]], inches: true },
    setChartData: {
        slots: [
            ['slide', 'shape'],
            ['categories', 'series']
        ]
    },
    setChartTitle: { slots: [['slide', 'shape'], 'title'] },
    setBackground: { slots: ['slide', 'color'] },
    deleteSlide: { slots: ['slide'] },
    moveSlide: { slots: ['from', ['to']] }
};
export const DOCX_OPS = {
    read: { slots: [], query: true },
    sections: { slots: [], query: true },
    paragraphStyles: { slots: [], query: true },
    setText: { slots: ['index', 'text'] },
    insertParagraphs: { slots: ['at', 'paragraphs'] },
    appendParagraphs: { slots: ['paragraphs'] },
    replaceSection: { slots: ['index', ['title', 'body']] },
    deleteSection: { slots: ['index'] },
    deleteBlocks: { slots: ['index', ['count']] },
    formatParagraph: { slots: ['index', 'format'] },
    formatStyle: { slots: ['name', 'format'] },
    addTable: { slots: ['at', ['rows', 'header', 'style']] },
    setCell: { slots: [['table', 'row', 'column'], 'text'], aliases: TABLE_INDEX },
    addRow: { slots: ['table', 'values', ['at']], aliases: TABLE_INDEX },
    deleteRow: { slots: [['table', 'row']], aliases: TABLE_INDEX },
    addImage: {
        slots: ['at', 'image', ['width', 'height', 'align', 'name', 'description']],
        inches: true
    },
    addChart: { slots: ['at', ['width', 'height', ...CHART]], inches: true },
    setChartData: { slots: ['index', ['categories', 'series'], ['chart']] },
    setChartTitle: { slots: ['index', 'title', ['chart']] }
};
export const XLSX_OPS = {
    sheets: { slots: [], query: true },
    read: { slots: ['sheet', ['range', 'limit']], query: true },
    get: { slots: ['sheet', 'ref'], query: true },
    setCells: { slots: ['sheet', 'cells'] },
    appendRows: { slots: ['sheet', 'rows'] },
    insertRows: { slots: ['sheet', ['at', 'rows', 'count']] },
    deleteRows: { slots: ['sheet', ['at', 'count']] },
    deleteColumns: { slots: ['sheet', ['column', 'count']] },
    setColumnWidth: { slots: ['sheet', ['column', 'width']] },
    addSheet: { slots: ['name', ['at']] },
    renameSheet: { slots: ['sheet', 'name'] },
    deleteSheet: { slots: ['sheet'] },
    addImage: {
        slots: ['sheet', 'image', ['cell', 'width', 'height', 'name', 'description']],
        inches: true
    },
    removeMacros: { slots: [] }
};
const LENGTHS = new Set(BOX);
export function opKeys(spec) {
    const keys = spec.slots.flatMap((slot) => (typeof slot === 'string' ? [slot] : [...slot]));
    return [...keys, ...Object.keys(spec.aliases ?? {})];
}
export function withAliases(spec, op) {
    const named = { ...op };
    for (const [alias, key] of Object.entries(spec.aliases ?? {})) {
        if (alias in named && named[key] === undefined) {
            named[key] = named[alias];
        }
        delete named[alias];
    }
    return named;
}
export function opArguments(spec, op, toEmu) {
    const value = (key) => {
        const raw = op[key];
        return spec.inches && LENGTHS.has(key) && typeof raw === 'number' ? toEmu(raw) : raw;
    };
    const args = spec.slots.map((slot) => {
        if (typeof slot === 'string') {
            return value(slot);
        }
        const present = slot.filter((key) => op[key] !== undefined);
        return present.length ? Object.fromEntries(present.map((key) => [key, value(key)])) : undefined;
    });
    while (args.length && args.at(-1) === undefined) {
        args.pop();
    }
    return args;
}
