import { unwrap } from 'asenion';
import { Agent } from '../agent/index.js';
import { unquoteArg } from './model-args.js';
import { stripControlTokens } from './control-tokens.js';
const MAX_LABEL_WORDS = 6;
const MAX_LABEL_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_ARGS_JSON = 1500;
const LABEL_INSTRUCTION = 'Write a 3 to 6 word label a person watching the run would read, and one sentence describing ' +
    'what the call does and to what, for a person deciding whether to approve it. ' +
    'Do not mention tools, code, JSON, or these instructions. ' +
    'Examples: Load apple-notes; Search today’s space news; Read example.com/docs.';
const ECHOED_INSTRUCTION = /3 to 6 words?|name the action|do not mention tools|person watching|tool call in|describe the outcome|not the code|run outcome description|^(skill )?tool call$/i;
export const TOOL_LABEL_SCHEMA = {
    type: 'json_schema',
    json_schema: {
        name: 'tool_label',
        schema: {
            type: 'object',
            properties: { label: { type: 'string' }, description: { type: 'string' } },
            required: ['label', 'description'],
            additionalProperties: false
        }
    }
};
export function buildToolLabelPrompt(name, args) {
    const json = JSON.stringify(args);
    const clipped = json.length > MAX_ARGS_JSON ? json.slice(0, MAX_ARGS_JSON) : json;
    return `${LABEL_INSTRUCTION}\nTool: ${name}\nArguments:\n${clipped}`;
}
function normalizeModelLabel(raw) {
    const firstLine = stripControlTokens(raw)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
    if (!firstLine) {
        return null;
    }
    const unlabeled = firstLine.replace(/^label\s*[:\-–]\s*/i, '');
    const unquoted = unwrap(unlabeled)
        .replace(/^["'`]+|["'`]+$/g, '')
        .trim();
    const words = unquoted.split(/\s+/).filter(Boolean).slice(0, MAX_LABEL_WORDS);
    if (words.length === 0) {
        return null;
    }
    const label = words
        .join(' ')
        .replace(/[.,;:!?]+$/, '')
        .trim()
        .slice(0, MAX_LABEL_LENGTH)
        .trim();
    if (!label || ECHOED_INSTRUCTION.test(label)) {
        return null;
    }
    return label;
}
export function skillCallLabel(args) {
    const name = stringArg(args, 'name') || stringArg(args, 'skill_name') || stringArg(args, 'skill');
    if (!name) {
        return 'Load skill instructions';
    }
    const title = titleSkillName(name);
    const file = stringArg(args, 'file');
    return file ? `Read ${title}/${fileName(file)}` : `Load ${title}`;
}
export function isSkillTool(name) {
    return name === Agent.SKILL_TOOL_NAME;
}
function stringArg(args, key) {
    const value = args[key];
    if (typeof value !== 'string') {
        return '';
    }
    return unquoteArg(value).trim();
}
function fileName(path) {
    const parts = path.split(/[/\\]/);
    return parts.at(-1) || path;
}
function titleSkillName(name) {
    return name
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
function normalizeModelDescription(raw) {
    const text = stripControlTokens(raw).replace(/\s+/g, ' ').trim();
    if (!text || ECHOED_INSTRUCTION.test(text)) {
        return undefined;
    }
    return text.length > MAX_DESCRIPTION_LENGTH
        ? `${text.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd()}…`
        : text;
}
export function parseToolLabelResponse(raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed);
            const label = typeof parsed.label === 'string' ? normalizeModelLabel(parsed.label) : null;
            if (!label) {
                return null;
            }
            const description = typeof parsed.description === 'string'
                ? normalizeModelDescription(parsed.description)
                : undefined;
            return description ? { label, description } : { label };
        }
        catch {
        }
    }
    const label = normalizeModelLabel(trimmed);
    return label ? { label } : null;
}
export function fallbackToolLabel(name, args = {}) {
    if (isSkillTool(name)) {
        return skillCallLabel(args);
    }
    const query = stringArg(args, 'query');
    if (query) {
        return `Search ${query}`.slice(0, MAX_LABEL_LENGTH).trim();
    }
    const url = stringArg(args, 'url');
    if (url) {
        const method = stringArg(args, 'method').toUpperCase();
        const target = displayUrl(url);
        return `${method ? `${method} ` : 'Read '}${target}`.slice(0, MAX_LABEL_LENGTH).trim();
    }
    const words = name.replace(/[_-]+/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}
function displayUrl(url) {
    const trimmed = url
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '');
    return trimmed || url;
}
