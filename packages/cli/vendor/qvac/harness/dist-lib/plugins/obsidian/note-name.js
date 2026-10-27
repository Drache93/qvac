import { HarnessError } from '../../lib/errors.js';
export function markdownFileName(name) {
    if (name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
        throw new HarnessError('OBSIDIAN_NOTE_NAME_IS_PATH');
    }
    return name.endsWith('.md') ? name : `${name}.md`;
}
