import fs from 'bare-fs';
import { spawnSync } from 'bare-subprocess';
const EXEMPT = {
    '@qvac/seed-defaults-operation-v1.agent': 'seedableAgent (lib/core/helpers/index.ts) allowlists the seed agent and leaves sharedIn off it',
    '@qvac/seed-defaults-operation-v1.chat': 'seedableChat (lib/core/helpers/index.ts) allowlists the seed chat and leaves projectId off it'
};
export function assertFieldOrder(root, schemaFile, tags) {
    const current = index(JSON.parse(fs.readFileSync(schemaFile, 'utf8')).schema);
    const seen = new Set();
    for (const tag of tags) {
        const baseline = index(JSON.parse(show(root, tag, schemaFile)).schema);
        for (const finding of shifts(baseline, current)) {
            const reason = EXEMPT[finding.at];
            if (!reason) {
                throw new Error(`${finding.at} grew ${finding.grew.join(',')} against ${tag}, and ${finding.behind.join(',')} ` +
                    'ship behind it. Append to the container instead, or exempt it in schema/field-order.ts ' +
                    'naming the code that keeps the field off the wire.');
            }
            seen.add(finding.at);
        }
        const risky = [...latent(baseline, current)];
        if (risky.length > 0) {
            const containers = [...new Set(risky.map((at) => at.split('.')[0]))];
            console.log(`field-order: ${risky.length} embedded records in ${containers.join(', ')} carry shipped ` +
                `fields behind them against ${tag}, safe until one of them grows`);
        }
    }
    for (const at of Object.keys(EXEMPT)) {
        if (!seen.has(at)) {
            throw new Error(`${at} is exempt in schema/field-order.ts but no longer shifts`);
        }
    }
}
function show(root, tag, file) {
    const at = file.slice(root.length + 1);
    const done = spawnSync('git', ['show', `${tag}:${at}`], { cwd: root });
    if (done.status !== 0) {
        throw new Error(`git show ${tag}:${at} failed: ${done.stderr ?? ''}`);
    }
    return String(done.stdout);
}
function index(schema) {
    return new Map(schema.map((type) => [`@${type.namespace}/${type.name}`, type]));
}
function* shifts(baseline, current) {
    for (const [name, container] of embeds(baseline, current)) {
        const grew = grown(baseline, current, container.type);
        if (grew.length > 0) {
            yield { at: name, grew, behind: container.behind };
        }
    }
}
function* latent(baseline, current) {
    for (const [name, container] of embeds(baseline, current)) {
        if (grown(baseline, current, container.type).length === 0) {
            yield name;
        }
    }
}
function* embeds(baseline, current) {
    for (const [name, type] of current) {
        const shipped = baseline.get(name);
        if (!shipped?.fields || !type.fields) {
            continue;
        }
        const known = new Set(shipped.fields.map((field) => field.name));
        for (let i = 0; i < type.fields.length; i++) {
            const field = type.fields[i];
            if (!current.get(field.type)?.versions) {
                continue;
            }
            const behind = type.fields
                .slice(i + 1)
                .map((later) => later.name)
                .filter((later) => known.has(later));
            if (field.array && known.has(field.name)) {
                behind.unshift('its own later elements');
            }
            if (behind.length > 0) {
                yield [`${name}.${field.name}`, { type: field.type, behind }];
            }
        }
    }
}
function grown(baseline, current, name) {
    const shipped = baseline.get(name);
    const now = current.get(name);
    if (!shipped?.versions || !now?.versions) {
        return [];
    }
    const out = [];
    for (const version of shipped.versions) {
        const mine = now.versions.find((entry) => entry.version === version.version);
        if (!mine) {
            continue;
        }
        const was = baseline.get(version.type);
        const is = current.get(mine.type);
        if (!was?.fields || !is?.fields) {
            continue;
        }
        const before = was.fields.map((field) => field.name);
        out.push(...is.fields.map((field) => field.name).filter((field) => !before.includes(field)));
        if (was.flagsPosition === -1 && (is.flagsPosition ?? -1) >= 0) {
            out.push('(flags byte)');
        }
    }
    return out;
}
