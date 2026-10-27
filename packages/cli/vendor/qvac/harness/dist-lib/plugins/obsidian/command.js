import { ShellLine } from '../../lib/tools/exec/shell-line.js';
const OBSIDIAN_BIN = /^obsidian(?:\.exe|\.com)?$/i;
const OBSIDIAN_PREFIX = /^obsidian(?:\.exe|\.com)?(?:\s|$)/i;
export function parseObsidianCommand(command) {
    const trimmed = command.trim();
    if (!OBSIDIAN_PREFIX.test(trimmed)) {
        return null;
    }
    const tokens = ShellLine.parse(trimmed).commands[0]?.argv ?? [];
    if (tokens.length === 0 || !OBSIDIAN_BIN.test(tokens[0] ?? '')) {
        return null;
    }
    if (tokens.length === 1) {
        return { action: '', args: [] };
    }
    const [, action, ...args] = tokens;
    return { action: action ?? '', args };
}
export function normalizeObsidianCommand(command) {
    return command.replace(/^(obsidian(?:\.exe|\.com)?)(\s+vault)\s+info(?=\s|$)/i, '$1$2');
}
