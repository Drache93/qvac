"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapResolutions = mapResolutions;
function mapResolutions(value, map) {
    const result = {};
    for (const [key, child] of Object.entries(value)) {
        const resolution = mapResolution(child, map);
        if (resolution !== undefined) {
            Object.defineProperty(result, key, { value: resolution, enumerable: true });
        }
    }
    return result;
}
function mapResolution(value, map) {
    if (typeof value === 'string')
        return map(value);
    if (Array.isArray(value)) {
        const result = [];
        for (const child of value) {
            const resolution = mapResolution(child, map);
            if (resolution !== undefined)
                result.push(resolution);
        }
        return result;
    }
    return mapResolutions(value, map);
}
