function omitted(count, locator, startLine) {
    const where = locator ? `; read_file path=${locator} startLine=${startLine}` : '';
    return `\n…[${count} chars omitted${where}]…\n`;
}
export function headTail(text, limit) {
    return text.length <= limit
        ? text
        : joinHeadTail({ head: text, tail: text, total: text.length }, limit);
}
export function joinHeadTail(ends, limit, locator) {
    const { head, tail, total } = ends;
    const kept = limit - omitted(total, locator, total).length;
    if (kept < 2) {
        return locator ? joinHeadTail(ends, limit) : head.slice(0, limit);
    }
    const end = Math.floor(kept / 2);
    const start = head.slice(0, kept - end);
    return `${start}${omitted(total - kept, locator, start.split('\n').length)}${tail.slice(tail.length - end)}`;
}
