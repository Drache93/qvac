import { appendOutput, capOutput, createCapturedOutput, formatOutput, MAX_OUTPUT_CHARS } from '../../lib/tools/exec/runner.js';
import { isObsidianRunning, launchObsidianApp, obsidianPathEnv } from './cli-process.js';
import { OBSIDIAN_CLI_FAILURE_GUIDANCE } from './guidance.js';
import { cleanObsidianOutput } from './output.js';
const READY_WAIT_MS = 5_000;
const COMMAND_MS = 15_000;
const OUTPUT_QUIET_MS = 700;
function delay(ms, signal) {
    return new Promise((resolve) => {
        if (signal?.aborted) {
            resolve();
            return;
        }
        const onAbort = () => {
            globalThis.clearTimeout(timer);
            resolve();
        };
        const timer = globalThis.setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}
function failedResult(outcome, exitCode) {
    const detail = [
        outcome.result ? `stdout:\n${outcome.result}` : '',
        outcome.stderr ? `stderr:\n${outcome.stderr}` : ''
    ]
        .filter(Boolean)
        .join('\n\n');
    const body = detail ? `\n\n${detail}` : '';
    return {
        stdout: '',
        stderr: `Obsidian command failed (exit code ${exitCode}).${body}\n\n${OBSIDIAN_CLI_FAILURE_GUIDANCE}`,
        exitCode
    };
}
export function toResult(outcome) {
    if (outcome.exitCode !== null && outcome.exitCode !== 0) {
        return failedResult(outcome, outcome.exitCode);
    }
    if (outcome.exitCode === null && outcome.stderr) {
        return {
            stdout: '',
            stderr: `${outcome.stderr}\n\n${OBSIDIAN_CLI_FAILURE_GUIDANCE}`,
            exitCode: 1
        };
    }
    if (outcome.result) {
        return { stdout: outcome.result, stderr: '', exitCode: 0 };
    }
    if (outcome.stderr) {
        return {
            stdout: '',
            stderr: `${outcome.stderr}\n\n${OBSIDIAN_CLI_FAILURE_GUIDANCE}`,
            exitCode: 1
        };
    }
    if (outcome.exitCode === 0) {
        return { stdout: '(no output)', stderr: '', exitCode: 0 };
    }
    return {
        stdout: '',
        stderr: 'Obsidian did not respond. Make sure the Obsidian desktop app is open, then try again.\n\n' +
            OBSIDIAN_CLI_FAILURE_GUIDANCE,
        exitCode: 1
    };
}
function runOnce(command, runtime, { timeoutMs, maxOutputChars, signal }) {
    return new Promise((resolve) => {
        if (signal?.aborted) {
            resolve({ result: '', stderr: '', exitCode: null });
            return;
        }
        const env = obsidianPathEnv();
        const child = runtime.spawn(command, {
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            env
        });
        const stdout = createCapturedOutput(maxOutputChars);
        const stderr = createCapturedOutput(maxOutputChars);
        let settled = false;
        let quietTimer;
        const finish = (exitCode) => {
            if (settled)
                return;
            settled = true;
            globalThis.clearTimeout(hardTimer);
            globalThis.clearTimeout(quietTimer);
            signal?.removeEventListener('abort', onAbort);
            try {
                if (child.pid !== undefined && runtime.killProcess) {
                    runtime.killProcess(-child.pid, 'SIGKILL');
                }
                else {
                    child.kill('SIGKILL');
                }
            }
            catch {
                child.kill('SIGKILL');
            }
            resolve({
                result: cleanObsidianOutput(formatOutput(stdout)),
                stderr: cleanObsidianOutput(formatOutput(stderr)),
                exitCode
            });
        };
        const hardTimer = globalThis.setTimeout(() => finish(null), timeoutMs);
        const onAbort = () => finish(null);
        signal?.addEventListener('abort', onAbort, { once: true });
        const bumpQuiet = () => {
            globalThis.clearTimeout(quietTimer);
            quietTimer = globalThis.setTimeout(() => finish(null), OUTPUT_QUIET_MS);
        };
        child.stdout?.on('data', (chunk) => {
            appendOutput(stdout, chunk);
            bumpQuiet();
        });
        child.stderr?.on('data', (chunk) => {
            appendOutput(stderr, chunk);
            bumpQuiet();
        });
        child.on('exit', (code) => finish(code));
        child.on('error', () => finish(null));
    });
}
export async function runObsidianCli(command, runtime, options = {}) {
    const signal = options.signal;
    const maxOutputChars = options.maxOutputChars ?? MAX_OUTPUT_CHARS;
    const timeoutMs = options.timeoutMs ?? COMMAND_MS;
    if (!(await isObsidianRunning(runtime.spawn, { killProcess: runtime.killProcess, signal }))) {
        if (signal?.aborted) {
            return { stdout: '', stderr: 'Obsidian command aborted.', exitCode: 1 };
        }
        launchObsidianApp(runtime.spawn);
        await delay(READY_WAIT_MS, signal);
    }
    if (signal?.aborted) {
        return { stdout: '', stderr: 'Obsidian command aborted.', exitCode: 1 };
    }
    const outcome = await runOnce(command, runtime, { timeoutMs, maxOutputChars, signal });
    if (signal?.aborted) {
        return { stdout: '', stderr: 'Obsidian command aborted.', exitCode: 1 };
    }
    const result = toResult(outcome);
    return {
        stdout: capOutput(result.stdout, maxOutputChars),
        stderr: capOutput(result.stderr, maxOutputChars),
        exitCode: result.exitCode
    };
}
