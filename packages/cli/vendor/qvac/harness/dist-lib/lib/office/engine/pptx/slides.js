import * as xml from '../xml.js';
import { DocsError } from '../errors.js';
import { layoutName, layoutType, hasBody } from './read.js';
const { p: P, r: R, p14: P14 } = xml.ns;
const REL_BASE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
export const PRESENTATION_ORDER = [
    'sldMasterIdLst',
    'notesMasterIdLst',
    'handoutMasterIdLst',
    'sldIdLst',
    'sldSz'
];
export function slideIdList(deck) {
    return xml.child(deck.pkg.root(deck.main), P, 'sldIdLst');
}
export function ensureSlideIdList(deck) {
    const existing = slideIdList(deck);
    if (existing) {
        return existing;
    }
    const top = deck.pkg.root(deck.main);
    return xml.insertOrdered(top, xml.builder(xml.owner(top), P)('sldIdLst'), PRESENTATION_ORDER);
}
export function entries(deck) {
    const list = slideIdList(deck);
    if (!list) {
        return [];
    }
    const rels = deck.pkg.rels(deck.main);
    return xml.children(list, P, 'sldId').map((el) => {
        const rId = el.getAttributeNS(R, 'id');
        const rel = rels.get(rId);
        if (!rel || rel.external || !rel.part || !deck.pkg.has(rel.part)) {
            throw new DocsError('BROKEN_PPTX', `slide id ${String(el.getAttribute('id'))} points at a missing part`);
        }
        return { el, id: xml.attr(el, 'id'), rId: rId ?? '', part: rel.part };
    });
}
export function slideAt(deck, index) {
    const all = entries(deck);
    const found = typeof index === 'number' && Number.isInteger(index) ? all[index] : undefined;
    if (!found) {
        const range = all.length ? ` (0 to ${all.length - 1})` : '';
        throw new DocsError('SLIDE_NOT_FOUND', `slide ${String(index)} does not exist; the deck has ${all.length} slides${range}`);
    }
    return found;
}
export function layoutOf(pkg, slidePart) {
    return pkg.related(slidePart, REL_BASE + 'slideLayout')[0] ?? null;
}
export function allLayouts(deck) {
    return deck.pkg
        .related(deck.main, REL_BASE + 'slideMaster')
        .flatMap((master) => deck.pkg.related(master, REL_BASE + 'slideLayout').map((part) => ({ master, part })));
}
function layoutByName(deck, layouts, name) {
    const wanted = name.toLowerCase();
    const match = layouts.find(({ part }) => layoutName(deck.pkg.xml(part)).toLowerCase() === wanted);
    if (match) {
        return match.part;
    }
    const names = layouts.map(({ part }) => `"${layoutName(deck.pkg.xml(part))}"`);
    throw new DocsError('LAYOUT_NOT_FOUND', `no layout is named "${name}"; the deck has ${names.join(', ')}`);
}
function defaultLayout(deck, layouts) {
    const { pkg } = deck;
    const used = entries(deck)
        .map((e) => layoutOf(pkg, e.part))
        .filter((part) => part !== null && layoutType(pkg.xml(part)) !== 'title' && hasBody(pkg.xml(part)));
    const last = used[used.length - 1];
    if (last) {
        return last;
    }
    const content = layouts.find(({ part }) => ['obj', 'tx'].includes(layoutType(pkg.xml(part))));
    return (content ?? layouts[0]).part;
}
export function pickLayout(deck, opts) {
    if (opts.like !== undefined && opts.layout !== undefined) {
        throw new DocsError('INVALID_OPTIONS', 'pass either like or layout, not both');
    }
    if (opts.like !== undefined) {
        const layout = layoutOf(deck.pkg, slideAt(deck, opts.like).part);
        if (!layout) {
            throw new DocsError('BROKEN_PPTX', `slide ${opts.like} has no layout`);
        }
        return layout;
    }
    const layouts = allLayouts(deck);
    if (layouts.length === 0) {
        throw new DocsError('BROKEN_PPTX', 'the deck has no slide layouts');
    }
    if (opts.layout !== undefined) {
        return layoutByName(deck, layouts, String(opts.layout));
    }
    return defaultLayout(deck, layouts);
}
function sectionIds(list) {
    return xml.children(list, P14, 'sldId').map((ref) => xml.attr(ref, 'id'));
}
export function placeInSection(deck, id) {
    const lists = xml.descendants(deck.pkg.root(deck.main), P14, 'sldIdLst');
    if (lists.length === 0) {
        return;
    }
    for (const list of lists) {
        for (const ref of xml.children(list, P14, 'sldId')) {
            if (ref.getAttribute('id') === id) {
                xml.remove(ref);
            }
        }
    }
    const order = entries(deck).map((e) => e.id);
    const pos = order.indexOf(id);
    const neighbor = order[pos - 1] ?? order[pos + 1];
    const home = lists.find((list) => sectionIds(list).includes(neighbor)) ?? lists[0];
    home.appendChild(xml.setAttributes(xml.named(xml.owner(home), `${home.prefix || 'p14'}:sldId`, P14), { id }));
    const sorted = xml
        .children(home, P14, 'sldId')
        .sort((x, y) => order.indexOf(xml.attr(x, 'id')) - order.indexOf(xml.attr(y, 'id')));
    for (const el of sorted) {
        home.appendChild(el);
    }
}
