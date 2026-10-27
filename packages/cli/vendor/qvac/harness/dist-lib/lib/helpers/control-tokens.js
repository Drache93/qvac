import { firstMarker, markers, strip, truncateAt } from 'asenion/guards';
import { scanner } from 'asenion/scan';
export const STOP_MARKERS = [...markers.controlTokens, ...markers.scaffold];
const [SCAFFOLD_OPENING] = markers.scaffold;
export const RUNAWAY_STOP_SEQUENCES = [SCAFFOLD_OPENING];
export function endsTurn(token) {
    return markers.turnEnd.includes(token);
}
export function controlTokenIndex(text) {
    return firstMarker(text, STOP_MARKERS)?.index ?? -1;
}
export function truncateAtControlToken(text) {
    return truncateAt(text, STOP_MARKERS);
}
export function stripControlTokens(text) {
    return strip(truncateAt(text, markers.scaffold), markers.controlTokens);
}
export async function* stopAtControlToken(tokens, onStop) {
    const safe = scanner({ stop: STOP_MARKERS });
    for await (const token of tokens) {
        const shown = safe.push(token);
        if (shown) {
            yield shown;
        }
        if (safe.stopped !== null) {
            onStop?.(safe.stopped);
            return;
        }
    }
    const rest = safe.flush();
    if (rest) {
        yield rest;
    }
}
