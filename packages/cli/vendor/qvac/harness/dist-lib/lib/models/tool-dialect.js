export function detectToolDialect(src, name) {
    const basename = src
        .toLowerCase()
        .split(/[/\\?#]/)
        .filter(Boolean)
        .pop() ?? '';
    const tag = `${(name ?? '').toLowerCase()}|${basename}`;
    if (/qwen3[._-]?[56](?![a-z0-9])/.test(tag)) {
        return 'qwen35';
    }
    if (/gemma[-_]?4(?=[^a-z0-9]|$)/.test(tag)) {
        return 'gemma4';
    }
    if (/gpt[_-]?oss/.test(tag)) {
        return 'harmony';
    }
    if (/deepseek[-_. ]?v(?:4|3[._-]?2)(?![0-9])/.test(tag)) {
        return 'dsml';
    }
    if (/lfm[_-]?\d/.test(tag)) {
        return 'pythonic';
    }
    return undefined;
}
