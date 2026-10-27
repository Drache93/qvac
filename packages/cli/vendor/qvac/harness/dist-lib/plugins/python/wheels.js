import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { errorMessage } from '../../lib/guards.js';
import { HarnessLog } from '../../lib/log.js';
const ManifestSchema = z.object({
    pyodide: z.string(),
    packages: z.record(z.string(), z.object({
        version: z.string().optional(),
        imports: z.array(z.string()).optional(),
        pypi: z.array(z.string()),
        pyodide: z.array(z.string())
    })),
    files: z.record(z.string(), z.object({ url: z.string(), sha256: z.string(), channel: z.enum(['pypi', 'pyodide']) }))
});
const STAGE_DIR = '/qvac-wheels';
export function wheelsDir() {
    return (process.env.QVAC_PYTHON_WHEELS_DIR ||
        path.dirname(fileURLToPath(typeof import.meta.asset === 'function'
            ? import.meta.asset('#pyodide-wheels')
            : import.meta.resolve('#pyodide-wheels'))));
}
export function vendoredManifest(dir = wheelsDir()) {
    const file = `${dir}/manifest.json`;
    if (!fs.existsSync(file)) {
        HarnessLog.info('python: no vendored wheels', { dir });
        return null;
    }
    try {
        return ManifestSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
    }
    catch (error) {
        HarnessLog.warn('python: vendored wheel manifest unusable', {
            file,
            err: errorMessage(error)
        });
        return null;
    }
}
export function normalizeDistribution(name) {
    return name
        .trim()
        .toLowerCase()
        .replace(/[-_.]+/g, '-');
}
function parseSpec(spec) {
    const [name, version] = spec.split('==');
    return { name: normalizeDistribution(name ?? ''), version: version?.trim() };
}
export function vendoredSpec(distribution, opts = {}) {
    const name = normalizeDistribution(distribution);
    const dir = opts.dir ?? wheelsDir();
    const manifest = opts.manifest === undefined ? vendoredManifest(dir) : opts.manifest;
    const entry = manifest?.packages[name];
    if (!entry) {
        return null;
    }
    const spec = entry.version ? `${name}==${entry.version}` : name;
    return planVendoredInstall([spec], { dir, manifest }) ? spec : null;
}
export function planVendoredInstall(specs, opts = {}) {
    const dir = opts.dir ?? wheelsDir();
    const manifest = opts.manifest === undefined ? vendoredManifest(dir) : opts.manifest;
    if (!manifest || specs.length === 0) {
        return null;
    }
    const wheels = new Set();
    const packages = new Set();
    for (const spec of specs) {
        const { name, version } = parseSpec(spec);
        const entry = manifest.packages[name];
        if (!entry || entry.version !== version) {
            return null;
        }
        for (const wheel of entry.pypi) {
            if (!fs.existsSync(`${dir}/${wheel}`)) {
                HarnessLog.warn('python: vendored wheel missing, installing from PyPI instead', { wheel });
                return null;
            }
            wheels.add(`${dir}/${wheel}`);
        }
        for (const dependency of entry.pyodide) {
            packages.add(dependency);
        }
    }
    return { wheels: [...wheels], packages: [...packages] };
}
export function stageVendoredWheels(target, install) {
    if (install.wheels.length > 0) {
        target.mkdirTree(STAGE_DIR);
    }
    return install.wheels.map((wheel) => {
        const staged = `${STAGE_DIR}/${wheel.slice(wheel.lastIndexOf('/') + 1)}`;
        if (!target.analyzePath(staged).exists) {
            target.writeFile(staged, new Uint8Array(fs.readFileSync(wheel)));
        }
        return `emfs:${staged}`;
    });
}
export function seedPackageCache(cacheDir, dir = wheelsDir()) {
    const manifest = vendoredManifest(dir);
    if (!manifest) {
        return;
    }
    fs.mkdirSync(cacheDir, { recursive: true });
    let seeded = 0;
    for (const [file, entry] of Object.entries(manifest.files)) {
        if (entry.channel !== 'pyodide' || fs.existsSync(`${cacheDir}/${file}`)) {
            continue;
        }
        if (!fs.existsSync(`${dir}/${file}`))
            continue;
        fs.copyFileSync(`${dir}/${file}`, `${cacheDir}/${file}`);
        seeded++;
    }
    if (seeded > 0) {
        HarnessLog.debug('python: seeded package cache', { cacheDir, wheels: seeded });
    }
}
