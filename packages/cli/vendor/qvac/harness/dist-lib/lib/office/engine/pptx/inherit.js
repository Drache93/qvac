import * as xml from '../xml.js';
const { a: A, p: P } = xml.ns;
const REL_BASE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const TITLE_TYPES = new Set(['title', 'ctrTitle']);
const DEFAULT_INSET = 91440;
const INSET_NAMES = {
    left: 'lIns',
    right: 'rIns',
    top: 'tIns',
    bottom: 'bIns'
};
const SIDES = ['left', 'right', 'top', 'bottom'];
export function placeholderOf(el) {
    const nv = xml.children(el)[0];
    const nvPr = nv ? xml.child(nv, P, 'nvPr') : null;
    const ph = nvPr ? xml.child(nvPr, P, 'ph') : null;
    if (!ph) {
        return null;
    }
    return { type: ph.getAttribute('type') || 'obj', idx: ph.getAttribute('idx') || null };
}
export function xfrmOf(el) {
    if (el.localName === 'graphicFrame') {
        return xml.child(el, P, 'xfrm');
    }
    const props = xml.child(el, P, el.localName === 'grpSp' ? 'grpSpPr' : 'spPr');
    return props ? xml.child(props, A, 'xfrm') : null;
}
export function explicitBox(el) {
    const xfrm = xfrmOf(el);
    const off = xfrm ? xml.child(xfrm, A, 'off') : null;
    const ext = xfrm ? xml.child(xfrm, A, 'ext') : null;
    if (!off || !ext) {
        return null;
    }
    return {
        x: Number(off.getAttribute('x')),
        y: Number(off.getAttribute('y')),
        width: Number(ext.getAttribute('cx')),
        height: Number(ext.getAttribute('cy'))
    };
}
function spTreeShapes(doc) {
    const tree = xml.descendants(doc, P, 'spTree')[0];
    return tree ? xml.children(tree, P, 'sp') : [];
}
function matchLayout(doc, key) {
    const shapes = spTreeShapes(doc).flatMap((el) => {
        const ph = placeholderOf(el);
        return ph ? [{ el, ph }] : [];
    });
    const byIdx = key.idx === null ? undefined : shapes.find((s) => s.ph.idx === key.idx);
    if (byIdx) {
        return byIdx.el;
    }
    return shapes.find((s) => s.ph.type === key.type)?.el ?? null;
}
function masterType(type) {
    if (TITLE_TYPES.has(type))
        return 'title';
    if (['dt', 'ftr', 'sldNum'].includes(type))
        return type;
    return 'body';
}
function matchMaster(doc, key) {
    const wanted = masterType(key.type);
    const found = spTreeShapes(doc).find((el) => {
        const ph = placeholderOf(el);
        return ph !== null && masterType(ph.type) === wanted;
    });
    return found ?? null;
}
function layoutOf(pkg, slide) {
    return pkg.related(slide, REL_BASE + 'slideLayout')[0];
}
function masterOf(pkg, layout) {
    return pkg.related(layout, REL_BASE + 'slideMaster')[0];
}
function chain(shape) {
    const { pkg, slide, el } = shape;
    const key = placeholderOf(el);
    const out = [el];
    const layout = key ? layoutOf(pkg, slide) : undefined;
    if (!key || !layout) {
        return out;
    }
    const layoutShape = matchLayout(pkg.xml(layout), key);
    if (layoutShape) {
        out.push(layoutShape);
    }
    const master = masterOf(pkg, layout);
    const masterShape = master ? matchMaster(pkg.xml(master), key) : null;
    if (masterShape) {
        out.push(masterShape);
    }
    return out;
}
export function box(shape) {
    for (const node of chain(shape)) {
        const found = explicitBox(node);
        if (found) {
            return found;
        }
    }
    return null;
}
function bodyPrOf(node) {
    const txBody = xml.child(node, P, 'txBody');
    return txBody ? xml.child(txBody, A, 'bodyPr') : null;
}
export function insets(shape) {
    const out = {
        left: DEFAULT_INSET,
        right: DEFAULT_INSET,
        top: DEFAULT_INSET / 2,
        bottom: DEFAULT_INSET / 2
    };
    const nodes = chain(shape);
    for (const side of SIDES) {
        const found = nodes.map(bodyPrOf).find((bodyPr) => bodyPr?.hasAttribute(INSET_NAMES[side]));
        if (found) {
            out[side] = Number(found.getAttribute(INSET_NAMES[side]));
        }
    }
    return out;
}
function levelSize(list, level) {
    const lvl = list ? xml.child(list, A, `lvl${level + 1}pPr`) : null;
    const def = lvl ? xml.child(lvl, A, 'defRPr') : null;
    return def?.hasAttribute('sz') ? Number(def.getAttribute('sz')) / 100 : null;
}
function styleName(key) {
    if (!key)
        return 'otherStyle';
    if (masterType(key.type) === 'title')
        return 'titleStyle';
    return ['body', 'obj', 'subTitle'].includes(key.type) ? 'bodyStyle' : 'otherStyle';
}
export function fontSize(shape, level) {
    for (const node of chain(shape)) {
        const txBody = xml.child(node, P, 'txBody');
        const size = levelSize(txBody ? xml.child(txBody, A, 'lstStyle') : null, level);
        if (size) {
            return size;
        }
    }
    const layout = layoutOf(shape.pkg, shape.slide);
    const master = layout ? masterOf(shape.pkg, layout) : undefined;
    if (!master) {
        return 18;
    }
    const styles = xml.child(shape.pkg.root(master), P, 'txStyles');
    const size = levelSize(styles ? xml.child(styles, P, styleName(placeholderOf(shape.el))) : null, level);
    return size || 18;
}
