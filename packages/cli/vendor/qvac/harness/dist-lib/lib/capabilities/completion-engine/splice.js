export function spliceFrom(base, next) {
    let at = 0;
    while (at < base.length && at < next.length && base[at] === next[at]) {
        at++;
    }
    return { at, messages: next.slice(at) };
}
