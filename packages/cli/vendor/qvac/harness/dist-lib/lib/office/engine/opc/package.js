import * as xml from '../xml.js';
import * as zip from './zip.js';
import * as paths from './paths.js';
import { ContentTypes, CONTENT_TYPES_NAME } from './content-types.js';
import { Relationships } from './relationships.js';
import { DocsError } from '../errors.js';
const RELATIONSHIPS_TYPE = 'application/vnd.openxmlformats-package.relationships+xml';
const STORED = new Set(['png', 'jpg', 'jpeg', 'gif', 'mp3', 'mp4', 'm4a', 'wav', 'zip']);
const DEFAULT_LIMITS = { maxEntries: 10000, maxSize: 512 * 1024 * 1024, maxRatio: 1000 };
function toBytes(input) {
    if (input instanceof Uint8Array)
        return input;
    if (input instanceof ArrayBuffer) {
        return new Uint8Array(input);
    }
    throw new DocsError('INVALID_INPUT', 'expected the file as a Uint8Array or Buffer');
}
function isDocument(data) {
    return !(data instanceof Uint8Array);
}
export class Package {
    static strict = false;
    strict;
    contentTypes;
    parts;
    folded;
    order;
    relsBySource;
    removed;
    edited;
    strays;
    constructor(entries, opts = {}) {
        this.strict = opts.strict ?? Package.strict;
        this.parts = new Map();
        this.folded = new Map();
        this.order = entries.map(([name]) => name);
        this.relsBySource = new Map();
        this.removed = false;
        this.edited = false;
        for (const [name, bytes] of entries) {
            this.store(name, { bytes, doc: null, dirty: false });
        }
        const types = this.parts.get(CONTENT_TYPES_NAME);
        if (!types?.bytes) {
            throw new DocsError('NOT_OOXML', 'the file has no [Content_Types].xml, so it is not an Office document');
        }
        this.contentTypes = new ContentTypes(types.bytes);
        this.forget(CONTENT_TYPES_NAME);
        this.strays = this.unreachable();
    }
    static open(bytes, opts = {}) {
        const limits = { ...DEFAULT_LIMITS, ...opts.limits };
        const entries = zip
            .read(toBytes(bytes), limits)
            .map((e) => [paths.normalize(e.name), e.data]);
        return new Package(entries, opts);
    }
    static create(opts = {}) {
        const types = xml.serialize(xml.parse(`<Types xmlns="${xml.ns.ct}"/>`));
        const pkg = new Package([[CONTENT_TYPES_NAME, types]], opts);
        pkg.contentTypes.addDefault('rels', RELATIONSHIPS_TYPE);
        pkg.contentTypes.addDefault('xml', 'application/xml');
        return pkg;
    }
    get changed() {
        return (this.edited ||
            this.contentTypes.dirty ||
            [...this.relsBySource.values()].some((rels) => rels.dirty));
    }
    names() {
        return [...this.parts.keys()].filter((name) => !name.endsWith('.rels'));
    }
    has(name) {
        return name !== null && this.find(name) !== null;
    }
    bytes(name) {
        const part = this.require(name);
        if (part.doc && part.dirty) {
            return xml.serialize(part.doc);
        }
        if (part.bytes) {
            return part.bytes;
        }
        if (part.doc) {
            return xml.serialize(part.doc);
        }
        throw new DocsError('PART_MISSING', `${name} has no content`);
    }
    xml(name) {
        const part = this.require(name);
        if (part.doc) {
            return part.doc;
        }
        const doc = xml.parse(part.bytes ?? new Uint8Array(0), name);
        part.doc = doc;
        if (this.strict) {
            part.snapshot = xml.toString(doc);
        }
        return doc;
    }
    root(name) {
        return xml.root(this.xml(name));
    }
    touch(name) {
        this.require(name).dirty = true;
        this.edited = true;
    }
    contentType(name) {
        return this.contentTypes.get(this.find(name) ?? name);
    }
    add(name, data, contentType) {
        if (this.find(name) !== null) {
            throw new DocsError('PART_EXISTS', `${name} already exists in the package`);
        }
        const doc = isDocument(data);
        this.store(name, { bytes: doc ? null : data, doc: doc ? data : null, dirty: doc });
        this.order.push(name);
        if (contentType && this.contentTypes.get(name) !== contentType) {
            this.contentTypes.setOverride(name, contentType);
        }
        this.edited = true;
    }
    write(name, data) {
        const part = this.require(name);
        const doc = isDocument(data);
        part.bytes = doc ? null : data;
        part.doc = doc ? data : null;
        part.dirty = doc;
        delete part.snapshot;
        this.edited = true;
    }
    remove(input) {
        const name = this.find(input);
        if (name === null) {
            return false;
        }
        this.forget(name);
        this.relsBySource.delete(name);
        const rels = this.find(paths.relsFor(name));
        if (rels !== null) {
            this.forget(rels);
        }
        this.contentTypes.removeOverride(name);
        this.removed = true;
        this.edited = true;
        return true;
    }
    rels(source) {
        const cached = this.relsBySource.get(source);
        if (cached) {
            return cached;
        }
        const stored = this.find(paths.relsFor(source));
        const rels = new Relationships(source, stored ? (this.parts.get(stored)?.bytes ?? null) : null);
        this.relsBySource.set(source, rels);
        return rels;
    }
    related(source, type) {
        const out = [];
        for (const rel of this.rels(source).byType(type)) {
            const part = rel.external ? null : this.find(rel.part);
            if (part !== null) {
                out.push(part);
            }
        }
        return out;
    }
    dropUnreferenced(source, types) {
        const used = referencedIds(this.root(source));
        const rels = this.rels(source);
        const dropped = rels.all().filter((rel) => types.includes(rel.type) && !used.has(rel.id));
        for (const rel of dropped) {
            rels.remove(rel.id);
        }
        if (dropped.length) {
            this.removed = true;
        }
        return dropped.map((rel) => rel.id);
    }
    freeName(pattern) {
        let n = 1;
        while (this.find(pattern.replace('%d', String(n))) !== null) {
            n++;
        }
        return pattern.replace('%d', String(n));
    }
    reachable() {
        const seen = new Set();
        const queue = ['/'];
        for (let source = queue.shift(); source !== undefined; source = queue.shift()) {
            for (const rel of this.rels(source).all()) {
                const part = rel.external ? null : this.resolveExisting(rel.part);
                if (part && !seen.has(part)) {
                    seen.add(part);
                    queue.push(part);
                }
            }
        }
        return seen;
    }
    prune() {
        const keep = this.reachable();
        const removed = this.names().filter((name) => !keep.has(name) && !this.strays.has(name));
        for (const name of removed) {
            this.remove(name);
        }
        return removed;
    }
    unreachable() {
        try {
            const keep = this.reachable();
            return new Set(this.names().filter((name) => !keep.has(name)));
        }
        catch {
            return new Set();
        }
    }
    save() {
        if (this.strict) {
            this.checkUntouched();
        }
        if (this.removed) {
            this.prune();
            this.removed = false;
        }
        this.edited = this.changed;
        this.flushRels();
        const untyped = [...this.parts.keys()].some((name) => name.endsWith('.rels') && !this.contentTypes.get(name));
        if (untyped) {
            this.contentTypes.addDefault('rels', RELATIONSHIPS_TYPE);
        }
        const names = [...new Set(this.order)].filter((name) => this.parts.has(name));
        names.sort((a, b) => Number(a !== '/_rels/.rels') - Number(b !== '/_rels/.rels'));
        return zip.write([
            { name: '[Content_Types].xml', data: this.contentTypes.serialize(), compress: true },
            ...names.map((name) => ({
                name: name.slice(1),
                data: this.bytes(name),
                compress: !STORED.has(paths.extension(name))
            }))
        ]);
    }
    checkUntouched() {
        for (const [name, part] of this.parts) {
            if (part.doc &&
                !part.dirty &&
                part.snapshot !== undefined &&
                xml.toString(part.doc) !== part.snapshot) {
                throw new DocsError('UNTOUCHED_EDIT', `${name} was changed without touch(), so the edit would be lost`);
            }
        }
    }
    flushRels() {
        for (const [source, rels] of this.relsBySource) {
            if (!rels.dirty)
                continue;
            const stored = this.find(rels.name);
            const existing = stored ? this.parts.get(stored) : undefined;
            const bytes = rels.serialize();
            if (existing) {
                existing.bytes = bytes;
                existing.doc = null;
                existing.dirty = false;
            }
            else if (source === '/' || this.find(source) !== null) {
                this.store(rels.name, { bytes, doc: null, dirty: false });
                this.order.push(rels.name);
            }
            rels.dirty = false;
        }
    }
    require(name) {
        const stored = this.find(name);
        const part = stored === null ? undefined : this.parts.get(stored);
        if (!part) {
            throw new DocsError('PART_MISSING', `${name} is not in the package`);
        }
        return part;
    }
    resolveExisting(name) {
        if (name === null)
            return null;
        const found = this.find(name);
        if (found !== null) {
            return found;
        }
        try {
            return this.find(decodeURI(name));
        }
        catch {
            return null;
        }
    }
    find(name) {
        if (name === null)
            return null;
        if (this.parts.has(name))
            return name;
        return this.folded.get(name.toLowerCase()) ?? null;
    }
    store(name, part) {
        this.parts.set(name, part);
        this.folded.set(name.toLowerCase(), name);
    }
    forget(name) {
        this.parts.delete(name);
        if (this.folded.get(name.toLowerCase()) === name) {
            this.folded.delete(name.toLowerCase());
        }
    }
}
export function referencedIds(top) {
    const used = new Set();
    const stack = [top];
    for (let el = stack.pop(); el; el = stack.pop()) {
        for (const attr of Array.from(el.attributes)) {
            if (attr.namespaceURI === xml.ns.r) {
                used.add(attr.value);
            }
        }
        stack.push(...xml.children(el));
    }
    return used;
}
