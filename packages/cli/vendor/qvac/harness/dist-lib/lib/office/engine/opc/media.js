import { probe } from '../image.js';
import * as paths from './paths.js';
export const IMAGE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
export function addImage(pkg, bytes, at) {
    const info = probe(bytes);
    pkg.contentTypes.addDefault(info.format, info.contentType);
    const part = pkg.freeName(paths.resolve(at.source, `${at.dir}/image%d.${info.format}`));
    pkg.add(part, bytes);
    const rId = pkg.rels(at.source).add(IMAGE_REL, part);
    return { rId, part, info };
}
