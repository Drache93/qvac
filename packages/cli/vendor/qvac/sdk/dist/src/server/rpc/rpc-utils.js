import { AbortController } from 'bare-abort-controller';
let commandCounter = 0;
export function getNextCommandId() {
    commandCounter = (commandCounter + 1) % Number.MAX_SAFE_INTEGER;
    return commandCounter;
}
export function isTerminalChunk(value) {
    return typeof value === 'object' && value !== null && 'done' in value && value.done === true;
}
/** Aborts when the client destroys its end of `wire` (and after a normal end). */
export function signalOnWireClose(wire) {
    const controller = new AbortController();
    wire.on('close', () => controller.abort(undefined));
    return controller.signal;
}
