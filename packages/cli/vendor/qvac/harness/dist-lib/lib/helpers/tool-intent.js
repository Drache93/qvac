import { stripControlTokens } from './control-tokens.js';
export const INTENT_PARAM = 'intent';
export const INTENT_PARAM_DESCRIPTION = 'One short sentence, addressed to the user, saying plainly what this call will ' +
    'do for them — the outcome, never the code. It is the only thing the approval ' +
    'prompt shows them.';
const MAX_INTENT_LENGTH = 160;
export function sanitizeToolIntent(value) {
    if (typeof value !== 'string')
        return undefined;
    const collapsed = stripControlTokens(value).replace(/\s+/g, ' ').trim();
    if (!collapsed) {
        return undefined;
    }
    return collapsed.length > MAX_INTENT_LENGTH ? collapsed.slice(0, MAX_INTENT_LENGTH) : collapsed;
}
export function takeToolIntent(args) {
    if (!(INTENT_PARAM in args)) {
        return { args };
    }
    const { [INTENT_PARAM]: raw, ...rest } = args;
    const intent = sanitizeToolIntent(raw);
    return intent === undefined ? { args: rest } : { args: rest, intent };
}
