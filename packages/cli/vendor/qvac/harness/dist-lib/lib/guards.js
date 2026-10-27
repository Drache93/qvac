export function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
export function errorMessage(err) {
    return err instanceof Error ? err.message : String(err);
}
export function errorCode(err) {
    if (!err || typeof err !== 'object' || !('code' in err))
        return undefined;
    return typeof err.code === 'string' ? err.code : undefined;
}
