import { unwrap } from 'asenion';
import { firstMarker, markers, truncateAt } from 'asenion/guards';
const LEAKS = [
    ...markers.controlTokens,
    ...markers.turnEnd,
    ...markers.thinking,
    ...markers.toolMarkup,
    ...markers.scaffold
];
const THINKING_CLOSE = markers.thinking.filter((marker) => marker.startsWith('</'));
export function cleanAnswer(raw, source = '') {
    const close = firstMarker(raw, THINKING_CLOSE);
    const body = close ? raw.slice(close.index + close.marker.length) : raw;
    const text = truncateAt(body, LEAKS).trim();
    return unwrap(source) === source ? unwrap(text) : text;
}
