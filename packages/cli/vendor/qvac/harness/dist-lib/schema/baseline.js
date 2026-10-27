import fs from 'bare-fs';
import path from 'bare-path';
import process from 'bare-process';
import { spawnSync } from 'bare-subprocess';
import { previousReleaseTags } from './release-tags.js';
export function rewindSpec(root, dirs, { carries, keep }) {
    if (process.env.SCHEMA_NO_BASELINE)
        return [];
    const baselines = previousReleaseTags(root, { carries });
    if (baselines.length === 0) {
        return [];
    }
    const held = keep.map((file) => {
        const target = path.join(root, file);
        return { target, contents: fs.readFileSync(target) };
    });
    for (const dir of dirs) {
        checkoutSpec(root, dir, baselines[0]);
    }
    for (const { target, contents } of held) {
        fs.writeFileSync(target, contents);
    }
    return baselines;
}
function checkoutSpec(root, dir, tag) {
    console.log(`rewinding ${path.relative(root, dir)} to ${tag}`);
    const done = spawnSync('git', ['checkout', tag, '--', dir], { cwd: root });
    if (done.status !== 0) {
        throw new Error(`checkout ${tag} failed: ${done.stderr ?? ''}`);
    }
}
export function unstageSpec(root, dirs) {
    const done = spawnSync('git', ['reset', '--quiet', 'HEAD', '--', ...dirs], { cwd: root });
    if (done.status !== 0) {
        throw new Error(`git reset -- spec failed: ${done.stderr ?? ''}`);
    }
}
export function resetHrpcIds(hrpcDir) {
    fs.rmSync(path.join(hrpcDir, 'hrpc.json'), { force: true });
}
