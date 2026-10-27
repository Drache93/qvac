import b4a from 'b4a';
import { constants as fsConstants } from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import { createGuardedFetch } from './guarded-fetch.js';
import { seedPackageCache } from './wheels.js';
class B4aTextDecoder {
    encoding;
    constructor(label = 'utf-8') {
        const normalized = String(label).toLowerCase();
        if (normalized.includes('16')) {
            this.encoding = 'utf16le';
        }
        else if (/latin1|iso-8859|ascii/.test(normalized)) {
            this.encoding = 'latin1';
        }
        else {
            this.encoding = 'utf8';
        }
    }
    decode(input) {
        if (input === undefined)
            return '';
        const view = input instanceof ArrayBuffer
            ? new Uint8Array(input)
            : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
        return b4a.toString(view, this.encoding);
    }
}
class B4aTextEncoder {
    encode(input = '') {
        return new Uint8Array(b4a.from(String(input), 'utf8'));
    }
}
export function nodeShapedProcess(base) {
    return new Proxy(base, {
        get(target, prop) {
            if (prop === 'versions') {
                return { ...target.versions, node: '22.0.0' };
            }
            if (prop === 'binding') {
                return (name) => (name === 'constants' ? { fs: fsConstants } : {});
            }
            if (prop === 'getuid') {
                return () => 0;
            }
            return Reflect.get(target, prop);
        }
    });
}
async function shapeBareGlobals() {
    const g = globalThis;
    if (!g.fetch) {
        const bareFetch = await import('bare-fetch');
        g.fetch = createGuardedFetch();
        g.Request = bareFetch.Request;
        g.Response = bareFetch.Response;
        g.Headers = bareFetch.Headers;
    }
    if (!g.AbortController) {
        const { AbortController, AbortSignal } = await import('bare-abort-controller');
        g.AbortController = AbortController;
        g.AbortSignal = AbortSignal;
    }
    if (!g.TextDecoder) {
        g.TextDecoder = B4aTextDecoder;
    }
    if (!g.TextEncoder) {
        g.TextEncoder = B4aTextEncoder;
    }
    if (!g.process) {
        g.process = nodeShapedProcess(process);
    }
    if (!g.performance) {
        const origin = Date.now();
        g.performance = { now: () => Date.now() - origin, timeOrigin: origin };
    }
}
const silentStdio = {
    stdin: () => null,
    stdout: (_msg) => { },
    stderr: (_msg) => { }
};
export function pyodideLoadOptions() {
    const cacheDir = process.env.QVAC_PYODIDE_CACHE_DIR;
    if (!cacheDir) {
        return { ...silentStdio };
    }
    return { ...silentStdio, packageCacheDir: cacheDir };
}
function pyodideIndexURL() {
    if (typeof import.meta.asset !== 'function') {
        return path.dirname(fileURLToPath(import.meta.resolve('pyodide'))) + '/';
    }
    import.meta.asset('pyodide/python_stdlib.zip');
    import.meta.asset('pyodide/pyodide-lock.json');
    return path.dirname(fileURLToPath(import.meta.asset('pyodide/pyodide.asm.wasm'))) + '/';
}
const JS_GLOBALS = [
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'fetch',
    'AbortController',
    'AbortSignal',
    'Object',
    'Request'
];
function guestGlobals() {
    const g = globalThis;
    const allowed = Object.create(null);
    for (const name of JS_GLOBALS) {
        Object.defineProperty(allowed, name, { get: () => g[name], enumerable: true });
    }
    return allowed;
}
function nullObject(fields) {
    return Object.assign(Object.create(null), fields);
}
function guestPyodideJs(py) {
    const api = py._api;
    const loadPackage = (names) => {
        const list = typeof names === 'string' ? [names] : Array.from(names);
        for (const name of list) {
            if (!Object.hasOwn(api.lockfile_packages, name)) {
                throw new Error(`not a lockfile package: ${name}`);
            }
        }
        return py.loadPackage(list);
    };
    const internals = nullObject({
        install: api.install,
        loadBinaryFile: () => {
            throw new Error('loadBinaryFile reads host files and is refused');
        },
        lockfile_packages: JSON.parse(JSON.stringify(api.lockfile_packages)),
        lockfile_info: JSON.parse(JSON.stringify(api.lockfile_info)),
        scheduleCallback: api.scheduleCallback,
        abortSignalAny: api.abortSignalAny,
        config: nullObject({ enableRunUntilComplete: api.config.enableRunUntilComplete })
    });
    const module = nullObject({ lockfileBaseUrl: py.lockfileBaseUrl, loadPackage, _api: internals });
    Object.defineProperty(module, 'loadedPackages', {
        get: () => py.loadedPackages,
        enumerable: true
    });
    return module;
}
const FORGET_PYODIDE_JS = `
def _forget(modules):
    for name in [name for name in modules if name == 'pyodide_js' or name.startswith('pyodide_js.')]:
        del modules[name]
_forget(__import__('sys').modules)
del _forget
`;
async function importPyodide() {
    if (typeof globalThis.Bare !== 'undefined') {
        await shapeBareGlobals();
    }
    const { loadPyodide } = await import('pyodide');
    const { default: createPyodideModule } = await import('pyodide/pyodide.asm.mjs');
    return { loadPyodide, createPyodideModule };
}
export async function loadPyodideAddons() {
    await importPyodide();
}
export function glueIsPatched(src) {
    return /function addEmJs\([^)]*\)\{throw /.test(src);
}
let warnedUnpatched = false;
export const defaultLoad = async () => {
    const { loadPyodide, createPyodideModule } = await importPyodide();
    if (!warnedUnpatched && !glueIsPatched(String(createPyodideModule))) {
        warnedUnpatched = true;
        console.warn('qvac-harness: pyodide is unpatched, guest Python can run host JS; copy patches/pyodide@314.0.2.patch');
    }
    const options = pyodideLoadOptions();
    if (options.packageCacheDir) {
        seedPackageCache(options.packageCacheDir);
    }
    const indexURL = pyodideIndexURL();
    const py = await loadPyodide({
        ...options,
        indexURL,
        createPyodideModule,
        jsglobals: guestGlobals()
    });
    py.registerJsModule('pyodide_js', guestPyodideJs(py));
    py.runPython(FORGET_PYODIDE_JS);
    return py;
};
