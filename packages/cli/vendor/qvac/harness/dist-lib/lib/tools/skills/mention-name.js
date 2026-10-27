const MENTION_PATTERN = /^@([a-z0-9][a-z0-9_-]*)(?=\s|$)/;
export function skillMentionName(text) {
    return MENTION_PATTERN.exec(text.trimStart().toLowerCase())?.[1] ?? null;
}
export function isMentionHandle(value) {
    return skillMentionName(`@${value}`) === value.toLowerCase();
}
export function skillMentionHandle(skill) {
    return (skill.displayName ?? skill.name).toLowerCase();
}
