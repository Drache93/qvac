import { errorMessage } from '../../lib/guards.js';
import { AbortedError } from '../../lib/helpers/race-abort.js';
import { HarnessError } from '../../lib/errors.js';
import { HarnessLog } from '../../lib/log.js';
import { capOutput } from '../../lib/tools/exec/runner.js';
import { collectOutputs, openScratch, stageInputFiles } from './memfs.js';
import { isGuardedFetch, setConnectPolicy } from './guarded-fetch.js';
import { NET_SHIM, pythonReachesNetwork } from './net-shim.js';
import { planVendoredInstall, stageVendoredWheels } from './wheels.js';
export function isPyodideFatal(error) {
    if (typeof error !== 'object' || error === null)
        return false;
    if ('pyodide_fatal_error' in error && error.pyodide_fatal_error === true) {
        return true;
    }
    return error instanceof Error && error.message.includes('and can no longer be used');
}
const DOUBLE_ESCAPED = /\\[nt"']/;
function unescapeSource(code) {
    return code.replace(/\\(n|t|r|"|'|\\)/g, (_, char) => {
        if (char === 'n')
            return '\n';
        if (char === 't')
            return '\t';
        if (char === 'r') {
            return '\r';
        }
        return char;
    });
}
export function repairDoubleEscapedSource(code, message) {
    if (!message.includes('SyntaxError'))
        return null;
    if (code.includes('\n'))
        return null;
    if (!DOUBLE_ESCAPED.test(code)) {
        return null;
    }
    const repaired = unescapeSource(code);
    return repaired === code ? null : repaired;
}
const promisingEval = new WeakMap();
async function enter(py, code, access) {
    const guarded = pythonReachesNetwork() && isGuardedFetch(globalThis.fetch);
    if (!access || !guarded || py.ffi === undefined || py.pyimport === undefined) {
        py.runPython(code);
        return;
    }
    let evalCode = promisingEval.get(py);
    if (!evalCode) {
        py.runPython(NET_SHIM);
        evalCode = py.pyimport('pyodide.code').eval_code;
        promisingEval.set(py, evalCode);
    }
    setConnectPolicy(access.policy);
    try {
        await evalCode.callPromising(code, py.globals);
    }
    finally {
        setConnectPolicy(null);
    }
}
async function attempt(py, code, { output, maxOutputChars, access }) {
    try {
        await enter(py, code, access);
        return {
            result: {
                stdout: capOutput(output.stdout, maxOutputChars),
                stderr: capOutput(output.stderr, maxOutputChars),
                exitCode: 0
            },
            error: null,
            fatal: false
        };
    }
    catch (error) {
        const message = errorMessage(error);
        return {
            result: {
                stdout: capOutput(output.stdout, maxOutputChars),
                stderr: capOutput(output.stderr || message, maxOutputChars),
                exitCode: 1
            },
            error: message,
            fatal: isPyodideFatal(error)
        };
    }
}
async function runOnce(py, code, opts) {
    const first = await attempt(py, code, opts);
    if (first.error === null) {
        return first;
    }
    const repaired = repairDoubleEscapedSource(code, first.error);
    if (repaired === null) {
        return first;
    }
    const retry = await attempt(py, repaired, opts);
    if (retry.error !== null && retry.error.includes('SyntaxError')) {
        return first;
    }
    return retry;
}
class InstallTimeoutError extends HarnessError {
    constructor(ms) {
        super('PACKAGE_INSTALL_TIMED_OUT', [ms]);
    }
}
function installSource(py, packages) {
    const plan = planVendoredInstall(packages);
    if (!plan) {
        return `import micropip\nawait micropip.install(${JSON.stringify(packages)})`;
    }
    const specs = [...stageVendoredWheels(py.FS, plan), ...plan.packages];
    HarnessLog.info('python: installing from vendored wheels', { specs });
    return `import micropip\nawait micropip.install(${JSON.stringify(specs)}, deps=False)`;
}
async function installPackages(py, packages, { timeoutMs, isCancelled }) {
    await py.loadPackage('micropip');
    if (isCancelled()) {
        throw new AbortedError();
    }
    const install = py.runPythonAsync(installSource(py, packages));
    let timer;
    const bound = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new InstallTimeoutError(timeoutMs)), timeoutMs);
    });
    try {
        await Promise.race([install, bound]);
    }
    finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}
const DELIVERABLE = /\.(pptx|docx|xlsx|pdf|png|jpe?g|gif|webp|csv|json|txt|md|zip|mp4|webm|m4a|mp3)$/i;
function listFiles(py, dir) {
    try {
        return new Set(py.FS.readdir(dir).filter((name) => name !== '.' && name !== '..'));
    }
    catch {
        return new Set();
    }
}
function newDeliverables(before, after) {
    return [...after].filter((name) => !before.has(name) && DELIVERABLE.test(name));
}
export async function performRun(py, spec, opts = {}) {
    const isCancelled = opts.isCancelled ?? (() => false);
    const ask = opts.askConnect ?? (async () => false);
    const gated = spec.hosts || spec.allowed;
    const access = spec.network === true
        ? { policy: gated ? { named: spec.hosts, ask, allowed: spec.allowed } : null }
        : null;
    const output = { stdout: '', stderr: '' };
    py.setStdout({ batched: (chunk) => (output.stdout += chunk + '\n') });
    py.setStderr({ batched: (chunk) => (output.stderr += chunk + '\n') });
    if (spec.packages?.length) {
        if (isCancelled()) {
            throw new AbortedError();
        }
        HarnessLog.info('python: installing packages', {
            packages: [...spec.packages],
            timeoutMs: spec.installTimeoutMs
        });
        setConnectPolicy(spec.allowed ? { ask, allowed: spec.allowed } : null);
        try {
            await installPackages(py, spec.packages, {
                timeoutMs: spec.installTimeoutMs,
                isCancelled
            });
            HarnessLog.info('python: packages ready', { packages: [...spec.packages] });
        }
        catch (error) {
            if (error instanceof AbortedError) {
                throw error;
            }
            const message = errorMessage(error);
            const timedOut = error instanceof InstallTimeoutError;
            const evict = timedOut || isPyodideFatal(error);
            HarnessLog.warn(timedOut ? 'python: package install timed out' : 'python: package install failed', {
                packages: [...spec.packages],
                err: message,
                evict
            });
            return {
                result: { stdout: '', stderr: capOutput(message, spec.maxOutputChars), exitCode: 1 },
                evict
            };
        }
        finally {
            setConnectPolicy(null);
        }
        output.stdout = '';
        output.stderr = '';
    }
    if (isCancelled()) {
        throw new AbortedError();
    }
    if (!spec.inputs?.length && !spec.outputs?.length && !spec.workdir) {
        const cwd = py.FS.cwd();
        const before = listFiles(py, cwd);
        const { result, fatal } = await runOnce(py, spec.code, {
            output,
            maxOutputChars: spec.maxOutputChars,
            access
        });
        if (result.exitCode !== 0) {
            return { result, evict: fatal };
        }
        const undeclared = newDeliverables(before, listFiles(py, cwd));
        return { result: undeclared.length > 0 ? { ...result, undeclared } : result, evict: false };
    }
    const scratch = openScratch(py.FS, spec.workdir);
    try {
        py.FS.chdir(scratch.cwd);
        stageInputFiles(py.FS, scratch.cwd, spec.inputs ?? []);
        const before = listFiles(py, scratch.cwd);
        const { result, fatal } = await runOnce(py, spec.code, {
            output,
            maxOutputChars: spec.maxOutputChars,
            access
        });
        const evict = fatal;
        if (evict) {
            return { result: { ...result, missing: spec.outputs ?? [] }, evict };
        }
        const outputs = collectOutputs(py.FS, scratch.cwd, spec.outputs ?? []);
        const declared = new Set(spec.outputs ?? []);
        const undeclared = result.exitCode === 0
            ? newDeliverables(before, listFiles(py, scratch.cwd)).filter((name) => !declared.has(name))
            : [];
        return {
            result: {
                ...result,
                files: outputs.files,
                missing: outputs.missing,
                rejected: outputs.rejected,
                undeclared: undeclared.length > 0 ? undeclared : undefined
            },
            evict: false
        };
    }
    finally {
        scratch[Symbol.dispose]();
    }
}
