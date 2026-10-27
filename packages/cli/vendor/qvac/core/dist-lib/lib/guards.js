export function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function errorMessage(err) {
    return err instanceof Error ? err.message : String(err);
}
export function asError(err) {
    return err instanceof Error ? err : new Error(String(err));
}
export function safeName(value) {
    const fenced = value.replace(/[^A-Za-z0-9._-]/g, '_');
    return /^\.*$/.test(fenced) ? `_${fenced}` : fenced;
}
