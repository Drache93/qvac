export function copy(value) {
    if (value === undefined)
        return value;
    return JSON.parse(JSON.stringify(value));
}
