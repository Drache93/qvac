import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { Version } from 'bare-semver';
export function currentReleaseVersion(root) {
    const file = path.join(root, 'package.json');
    const { version } = JSON.parse(fs.readFileSync(file, 'utf8'));
    try {
        return Version.parse(version);
    }
    catch {
        throw new Error(`no release version in package version ${version}`);
    }
}
const TAG_PREFIX = 'v';
export function previousReleaseTags(root, { count = 3, carries }) {
    const current = currentReleaseVersion(root);
    const listed = spawnSync('git', ['tag', '-l', `${TAG_PREFIX}*`], { cwd: root });
    if (listed.status !== 0) {
        throw new Error(`git tag -l failed: ${listed.stderr ?? ''}`);
    }
    const newestPerLine = new Map();
    for (const line of (listed.stdout?.toString() ?? '').split('\n')) {
        const parsed = parseTag(line.trim());
        if (!parsed || Version.compare(parsed.version, current) > 0) {
            continue;
        }
        const winner = newestPerLine.get(parsed.line);
        if (!winner || Version.compare(parsed.version, winner.version) > 0) {
            newestPerLine.set(parsed.line, parsed);
        }
    }
    if (newestPerLine.size === 0) {
        console.log(`no ${TAG_PREFIX}* release tag before ${current} — skipping the baseline rewind`);
        return [];
    }
    const tags = [...newestPerLine.values()]
        .sort((a, b) => Version.compare(b.version, a.version))
        .map(({ tag }) => tag)
        .filter((tag) => hasPath(root, tag, carries));
    if (tags.length === 0) {
        throw new Error(`no ${TAG_PREFIX}* tag before ${current} carries ${carries} — run \`git fetch --tags\``);
    }
    return tags.slice(0, count);
}
function parseTag(name) {
    if (!name.startsWith(TAG_PREFIX))
        return null;
    try {
        const version = Version.parse(name.slice(TAG_PREFIX.length));
        if (version.prerelease.length > 0) {
            return null;
        }
        return { tag: name, version, line: `${version.major}.${version.minor}` };
    }
    catch {
        return null;
    }
}
function hasPath(root, tag, target) {
    const found = spawnSync('git', ['cat-file', '-e', `${tag}^{commit}:${target}`], { cwd: root });
    return found.status === 0;
}
