import { Range, Version, satisfies } from 'bare-semver';
export function releaseVersion(version) {
    const match = version
        .trim()
        .replace(/^[vV]/, '')
        .match(/^\d+\.\d+\.\d+/);
    if (!match) {
        throw new Error(`unparseable version: ${version}`);
    }
    return match[0];
}
export function updateRequired({ range, appVersion }) {
    if (!range || !appVersion)
        return false;
    const floor = parseRange(range);
    if (!floor) {
        return false;
    }
    try {
        return !satisfies(Version.parse(releaseVersion(appVersion)), floor);
    }
    catch {
        return false;
    }
}
function parseRange(range) {
    try {
        return Range.parse(range);
    }
    catch {
        return null;
    }
}
