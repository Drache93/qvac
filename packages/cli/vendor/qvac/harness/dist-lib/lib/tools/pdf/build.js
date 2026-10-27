import b4a from 'b4a';
const READ_TEXT_LIMIT = 30_000;
function plural(count, noun) {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
export function pagesLabel(count) {
    return plural(count, 'page');
}
function zeroBased(opened, pages) {
    if (!pages) {
        return Array.from({ length: opened.doc.pageCount() }, (_, page) => page);
    }
    const count = opened.doc.pageCount();
    const outside = pages.filter((page) => page < 1 || page > count);
    if (outside.length) {
        return `${opened.source.fileName} has ${pagesLabel(count)}, numbered 1 to ${count}; there is no page ${outside.join(', ')}`;
    }
    return pages.map((page) => page - 1);
}
function describeField(field) {
    return {
        name: field.name,
        type: field.type,
        value: field.value,
        options: field.options,
        readOnly: field.readOnly || undefined
    };
}
const SHOWN = {
    one: 'shown to you as an image in the user message, so read its content from that image',
    many: 'shown to you as images in the user message, so read their content from those images'
};
function scannedNote(scanned, shown) {
    if (!scanned.length)
        return undefined;
    const one = scanned.length === 1;
    const what = one ? 'it is a scanned image' : 'they are scanned images';
    const where = shown ? SHOWN[one ? 'one' : 'many'] : 'and there is no OCR here';
    return `${one ? 'page' : 'pages'} ${scanned.join(', ')} ${one ? 'has' : 'have'} no text layer: ${what}, ${where}`;
}
export function textless({ doc }) {
    for (const page of doc.textPages()) {
        if (page.text.trim())
            return false;
    }
    return true;
}
export function everyPageShown({ source, doc }, isShown) {
    for (let page = 1; page <= doc.pageCount(); page++) {
        if (!isShown(source.fileName, page))
            return false;
    }
    return true;
}
export function shownNote({ source, doc }) {
    const one = doc.pageCount() === 1;
    const what = one ? 'it is a scanned image' : 'its pages are scanned images';
    return `${source.fileName} has no text layer: ${what}, ${SHOWN[one ? 'one' : 'many']}`;
}
function readOne({ source, doc }, budget, isShown) {
    const pages = [];
    const scanned = [];
    let truncated = false;
    for (const { page, text } of doc.textPages()) {
        const clean = text.replace(/\r\n?/g, '\n').trim();
        if (!clean) {
            scanned.push(page + 1);
        }
        const kept = clean.slice(0, Math.max(0, budget.chars));
        budget.chars -= kept.length;
        truncated ||= kept.length < clean.length;
        if (budget.chars > 0 || kept) {
            pages.push({ page: page + 1, text: kept });
        }
    }
    return {
        attachmentId: source.attachmentId,
        fileName: source.fileName,
        pageCount: doc.pageCount(),
        pages,
        fields: doc.fields().map(describeField),
        note: scannedNote(scanned, scanned.every((page) => isShown(source.fileName, page))),
        truncated: truncated || undefined
    };
}
export function readDocs(opened, isShown) {
    const budget = { chars: READ_TEXT_LIMIT };
    const documents = opened.map((one) => readOne(one, budget, isShown));
    const [only] = documents;
    return documents.length === 1 && only ? only : { documents };
}
function fromDoc(doc, bytes) {
    return { bytes, pageCount: doc.pageCount() };
}
function joinPages(pdfium, parts, pages) {
    const out = pdfium.create();
    try {
        for (const part of parts) {
            out.importPages(part.doc, { pages });
        }
        return fromDoc(out, out.save());
    }
    finally {
        out.close();
    }
}
function textFile({ source, doc }) {
    const text = [...doc.textPages()]
        .map((page) => page.text.replace(/\r\n?/g, '\n').trim())
        .join('\n\n');
    if (!text.trim()) {
        return `${source.fileName} has no text layer: its pages are scanned images, and there is no OCR here`;
    }
    return { bytes: b4a.from(text + '\n', 'utf8'), pageCount: doc.pageCount() };
}
function create(pdfium, request) {
    const encrypt = request.password ? { password: request.password } : undefined;
    const bytes = pdfium.compose(request.markdown, {
        pageSize: request.pageSize,
        landscape: request.landscape,
        pageNumbers: request.pageNumbers,
        encrypt
    });
    return { bytes, pageCount: pdfium.pageCount(bytes, { password: request.password }) };
}
function editOne(opened, request) {
    const { doc } = opened;
    switch (request.action) {
        case 'rotate':
        case 'watermark': {
            const pages = zeroBased(opened, request.pages);
            if (typeof pages === 'string') {
                return pages;
            }
            if (request.action === 'rotate') {
                doc.rotate(request.degrees, { pages });
            }
            else {
                doc.watermark(request.text, { pages, opacity: request.opacity, position: request.position });
            }
            return fromDoc(doc, doc.save());
        }
        case 'fill':
            doc.fillFields(request.values);
            return fromDoc(doc, doc.save());
        case 'encrypt': {
            const password = request.password ?? '';
            const { ownerPassword, permissions } = request;
            return fromDoc(doc, doc.save({ encrypt: { password, ownerPassword, permissions } }));
        }
        case 'decrypt':
            return fromDoc(doc, doc.save({ removeSecurity: true }));
        case 'text':
            return textFile(opened);
        default:
            return `${request.action} is not an edit`;
    }
}
export function build(pdfium, request, opened) {
    const [first] = opened;
    if (request.action === 'create') {
        return create(pdfium, request);
    }
    if (!first) {
        return 'no PDF to work on';
    }
    if (request.action === 'merge') {
        return joinPages(pdfium, opened);
    }
    if (request.action !== 'split') {
        return editOne(first, request);
    }
    const pages = zeroBased(first, request.pages);
    return typeof pages === 'string' ? pages : joinPages(pdfium, [first], pages);
}
