import * as xml from '../xml.js';
import { extension } from './paths.js';
export const CONTENT_TYPES_NAME = '/[Content_Types].xml';
export class ContentTypes {
    doc;
    dirty;
    original;
    constructor(bytes) {
        this.original = bytes;
        this.doc = xml.parse(bytes ?? `<Types xmlns="${xml.ns.ct}"/>`, CONTENT_TYPES_NAME);
        this.dirty = !bytes;
    }
    get root() {
        return xml.root(this.doc);
    }
    get(partName) {
        const override = this.override(partName);
        if (override) {
            return override.getAttribute('ContentType');
        }
        const ext = extension(partName);
        const entry = this.defaults().find((el) => xml.attr(el, 'Extension').toLowerCase() === ext);
        return entry ? entry.getAttribute('ContentType') : null;
    }
    hasDefault(ext) {
        return this.defaults().some((el) => xml.attr(el, 'Extension').toLowerCase() === ext.toLowerCase());
    }
    addDefault(ext, contentType) {
        if (this.hasDefault(ext))
            return;
        const el = xml.setAttributes(xml.named(this.doc, 'Default', xml.ns.ct), {
            Extension: ext,
            ContentType: contentType
        });
        this.root.insertBefore(el, xml.child(this.root, xml.ns.ct, 'Override'));
        this.dirty = true;
    }
    setOverride(partName, contentType) {
        const existing = this.override(partName);
        if (existing?.getAttribute('ContentType') === contentType) {
            return;
        }
        if (existing) {
            existing.setAttribute('ContentType', contentType);
        }
        else {
            const el = xml.named(this.doc, 'Override', xml.ns.ct);
            this.root.appendChild(xml.setAttributes(el, { PartName: partName, ContentType: contentType }));
        }
        this.dirty = true;
    }
    removeOverride(partName) {
        const existing = this.override(partName);
        if (!existing) {
            return;
        }
        xml.remove(existing);
        this.dirty = true;
    }
    serialize() {
        if (!this.dirty && this.original)
            return this.original;
        return xml.serialize(this.doc);
    }
    defaults() {
        return xml.children(this.root, xml.ns.ct, 'Default');
    }
    override(partName) {
        const wanted = partName.toLowerCase();
        return xml
            .children(this.root, xml.ns.ct, 'Override')
            .find((el) => xml.attr(el, 'PartName').toLowerCase() === wanted);
    }
}
