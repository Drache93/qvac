export function compileGlob(pattern) {
    let source = '';
    let i = 0;
    while (i < pattern.length) {
        const c = pattern.charAt(i);
        if (c === '*' && pattern[i + 1] === '*' && pattern[i + 2] === '/') {
            source += '(?:.*/)?';
            i += 3;
        }
        else if (c === '*' && pattern[i + 1] === '*') {
            source += '.*';
            i += 2;
        }
        else if (c === '*') {
            source += '[^/]*';
            i += 1;
        }
        else if (c === '?') {
            source += '[^/]';
            i += 1;
        }
        else {
            source += /[.+^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
            i += 1;
        }
    }
    const regex = new RegExp(`^${source}$`);
    return (relPath) => regex.test(relPath);
}
