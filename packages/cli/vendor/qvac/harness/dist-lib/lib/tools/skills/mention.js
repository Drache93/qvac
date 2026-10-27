import { has } from 'asenion';
import { skillMentionHandle, skillMentionName } from './mention-name.js';
export { skillMentionHandle, skillMentionName };
export function resolveSkillMention(text, catalog) {
    const name = skillMentionName(text);
    if (!name) {
        return null;
    }
    return (catalog.find((skill) => skill.displayName?.toLowerCase() === name) ??
        catalog.find((skill) => !skill.displayName && skill.name.toLowerCase() === name) ??
        null);
}
const MIN_IMPLICIT_NAME_LENGTH = 4;
function matchesName(text, candidate) {
    for (const part of candidate.split('+')) {
        if (!has(text, part))
            return false;
    }
    return true;
}
function withoutMention(text) {
    const name = skillMentionName(text);
    return name ? text.trimStart().slice(name.length + 1) : text;
}
export function resolveImplicitSkill(text, activeSkills) {
    const prose = withoutMention(text);
    let best = null;
    let bestLength = 0;
    for (const skill of activeSkills) {
        const names = skill.preloadOnName === false ? (skill.aliases ?? []) : [skill.name, ...(skill.aliases ?? [])];
        for (const word of names) {
            const candidate = word.toLowerCase();
            if (candidate.length < MIN_IMPLICIT_NAME_LENGTH) {
                continue;
            }
            if (!matchesName(prose, candidate)) {
                continue;
            }
            const weight = candidate.replace(/\+/g, '').length;
            if (weight > bestLength) {
                best = skill;
                bestLength = weight;
            }
        }
    }
    return best;
}
