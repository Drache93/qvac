import { holdback } from 'asenion/scan';
export function createJoinGuard(markers) {
    let held = '';
    let join = -1;
    return {
        push(text) {
            let buffer = held + text;
            if (join !== -1) {
                const mended = mend(buffer, join, markers);
                buffer = mended.text;
                join = mended.at;
            }
            const keep = holdback(buffer, markers);
            const shown = buffer.slice(0, buffer.length - keep);
            held = buffer.slice(buffer.length - keep);
            join = join === -1 || join < shown.length ? -1 : join - shown.length;
            return shown;
        },
        cut() {
            join = held.length;
        },
        flush() {
            const rest = held;
            held = '';
            join = -1;
            return rest;
        }
    };
}
function mend(text, at, markers) {
    for (;;) {
        const found = spanning(text, at, markers);
        if (found === null) {
            return { text, at };
        }
        text = text.slice(0, found.index) + text.slice(found.index + found.marker.length);
        at = found.index;
    }
}
function spanning(text, at, markers) {
    for (const marker of markers) {
        const index = text.indexOf(marker, Math.max(0, at - marker.length + 1));
        if (index !== -1 && index < at) {
            return { index, marker };
        }
    }
    return null;
}
