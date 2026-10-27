import fs from 'fs';
import path from 'path';
import process from 'process';
import { withHomebrewPath } from '../../helpers/spawn-path.js';
const SAFE_BIN_NAME = /^[A-Za-z0-9._-]+$/;
function envPath() {
    return process.env.PATH ?? process.env.Path ?? '';
}
function existsFile(p) {
    try {
        return fs.existsSync(p);
    }
    catch {
        return false;
    }
}
export function binOnPath(bin, platform) {
    if (!SAFE_BIN_NAME.test(bin))
        return false;
    const searchPath = withHomebrewPath(envPath(), platform ?? process.platform) ?? '';
    const dirs = searchPath.split(path.delimiter).filter((d) => d.length > 0);
    const names = platform === 'win32' ? [bin, `${bin}.exe`, `${bin}.cmd`, `${bin}.bat`] : [bin];
    return dirs.some((dir) => names.some((name) => existsFile(path.join(dir, name))));
}
export function missingBins(bins, platform, probe = binOnPath) {
    return bins.filter((bin) => !probe(bin, platform));
}
function parseVersion(text) {
    const m = text.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}
function versionState(found, min) {
    if (!found || !min)
        return 'unknown';
    return isBelow(found, min) ? 'too-old' : 'ok';
}
function isBelow(found, min) {
    for (let i = 0; i < Math.max(found.length, min.length); i++) {
        const f = found[i] ?? 0;
        const m = min[i] ?? 0;
        if (f !== m) {
            return f < m;
        }
    }
    return false;
}
export async function probeBinVersions(requires, opts) {
    const states = new Map();
    const mins = requires?.binMinVersions;
    if (!mins) {
        return states;
    }
    const binPresent = opts.binPresent ?? ((bin) => binOnPath(bin, opts.platform));
    for (const [bin, spec] of Object.entries(mins)) {
        if (!spec.command || !(await binPresent(bin)))
            continue;
        const output = await opts.run(spec.command);
        const found = output === null ? null : parseVersion(output);
        const min = parseVersion(spec.min);
        states.set(bin, versionState(found, min));
    }
    return states;
}
