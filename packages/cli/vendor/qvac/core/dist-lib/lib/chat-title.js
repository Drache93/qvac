import { unwrap } from 'asenion';
import { isRecord } from './guards.js';
const DEFAULT_TITLES = new Set(['New Chat', 'General']);
const MAX_TITLE_WORDS = 6;
const DERIVED_TITLE_WORDS = 3;
const MAX_TITLE_LENGTH = 60;
export function isDefaultChatTitle(title) {
    return DEFAULT_TITLES.has((title ?? '').trim());
}
const TITLE_INSTRUCTION = 'Generate a short, descriptive title of 3 to 6 words for a conversation that begins with the ' +
    'message below. Name the conversation; do not answer it.';
export function buildTitlePrompt(input) {
    return `${TITLE_INSTRUCTION}\n\nMessage:\n${input}`;
}
export function normalizeModelTitle(raw) {
    const firstLine = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
    if (!firstLine) {
        return null;
    }
    const unlabeled = firstLine.replace(/^title\s*[:\-–]\s*/i, '');
    const unquoted = unwrap(unlabeled)
        .replace(/^["'`]+|["'`]+$/g, '')
        .trim();
    const words = unquoted.split(/\s+/).filter(Boolean).slice(0, MAX_TITLE_WORDS);
    if (words.length === 0) {
        return null;
    }
    const title = words
        .join(' ')
        .replace(/[.,;:!?]+$/, '')
        .trim()
        .slice(0, MAX_TITLE_LENGTH)
        .trim();
    return title || null;
}
export function parseTitleResponse(raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed);
            const title = isRecord(parsed) ? parsed.title : undefined;
            return typeof title === 'string' ? normalizeModelTitle(title) : null;
        }
        catch {
        }
    }
    return normalizeModelTitle(trimmed);
}
export function deriveChatTitle(content) {
    const words = content
        .replace(/[`*_#[\]()]/g, ' ')
        .split(/\s+/)
        .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
        .filter(Boolean)
        .slice(0, DERIVED_TITLE_WORDS);
    if (words.length === 0) {
        return null;
    }
    return words.join(' ').slice(0, MAX_TITLE_LENGTH);
}
