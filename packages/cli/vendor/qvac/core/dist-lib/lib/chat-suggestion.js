import { unwrap } from 'asenion';
import { isRecord } from './guards.js';
const MAX_SUGGESTION_WORDS = 14;
const MAX_SUGGESTION_LENGTH = 100;
const ANSWER_TAIL = 1500;
const SUGGESTION_INSTRUCTION = [
    'Below is the last exchange of a conversation. Write the next message the user is most likely to',
    'send: an instruction from the user to the assistant, at most 12 words. When the answer suggests',
    'or offers something, the user asks for it. Never write a question the assistant would ask.',
    'Example: after an answer listing what a .gitignore should hold, write "Create that .gitignore",',
    'not "Should I add more files to the .gitignore?".',
    'Return an empty prompt when no natural next message follows.'
].join(' ');
export function buildSuggestionPrompt(question, answer) {
    const tail = answer.length > ANSWER_TAIL ? '…' + answer.slice(-ANSWER_TAIL) : answer;
    return `${SUGGESTION_INSTRUCTION}\n\nUser:\n${question}\n\nAssistant:\n${tail}`;
}
export function normalizeSuggestion(raw) {
    const line = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find(Boolean);
    if (!line) {
        return null;
    }
    const words = unwrap(line.replace(/^(user|prompt|next)\s*[:\-–]\s*/i, ''))
        .replace(/^["'`]+|["'`]+$/g, '')
        .split(/\s+/)
        .filter(Boolean);
    if (words.length === 0 || words.length > MAX_SUGGESTION_WORDS) {
        return null;
    }
    return words.join(' ').slice(0, MAX_SUGGESTION_LENGTH).trim() || null;
}
export function parseSuggestionResponse(raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed);
            const prompt = isRecord(parsed) ? parsed.prompt : undefined;
            return typeof prompt === 'string' ? normalizeSuggestion(prompt) : null;
        }
        catch {
        }
    }
    return normalizeSuggestion(trimmed);
}
