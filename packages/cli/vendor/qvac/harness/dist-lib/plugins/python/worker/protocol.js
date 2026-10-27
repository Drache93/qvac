export function toWireResult(result) {
    return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        files: result.files ? [...result.files.entries()] : undefined,
        missing: result.missing,
        rejected: result.rejected,
        undeclared: result.undeclared
    };
}
export function fromWireResult(wire) {
    return {
        stdout: wire.stdout,
        stderr: wire.stderr,
        exitCode: wire.exitCode,
        files: wire.files ? new Map(wire.files) : undefined,
        missing: wire.missing,
        rejected: wire.rejected,
        undeclared: wire.undeclared
    };
}
function messageType(value) {
    if (typeof value !== 'object' || value === null || !('type' in value)) {
        return null;
    }
    return typeof value.type === 'string' ? value.type : null;
}
function isHostMessage(value) {
    const type = messageType(value);
    return type === 'run' || type === 'close' || type === 'connect-answer';
}
function isWorkerMessage(value) {
    const type = messageType(value);
    return (type === 'log' ||
        type === 'ready' ||
        type === 'boot-error' ||
        type === 'result' ||
        type === 'connect-ask');
}
export function asHostMessage(value) {
    return isHostMessage(value) ? value : null;
}
export function asWorkerMessage(value) {
    return isWorkerMessage(value) ? value : null;
}
