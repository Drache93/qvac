import { spawn } from 'child_process';
import path from 'path';
import process from 'process';
import { execEnv } from '../../lib/helpers/spawn-path.js';
const STDERR_TAIL = 2_000;
export function spawnAgent(command, args, { cwd, env }) {
    const child = spawn(command, [...args], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    let partial = '';
    const listeners = [];
    const exited = new Promise((resolve) => {
        child.on('exit', (code, signal) => resolve({ code, signal: signal ?? null }));
        child.on('error', () => resolve({ code: null, signal: null }));
    });
    const closed = new Promise((resolve) => {
        child.on('close', (code, signal) => resolve({ code, signal: signal ?? null }));
        child.on('error', () => resolve({ code: null, signal: null }));
    });
    child.stdin?.on('error', () => { });
    child.stderr?.on('data', (chunk) => {
        stderr = (stderr + String(chunk)).slice(-STDERR_TAIL);
    });
    child.stdout?.on('data', (chunk) => {
        const lines = (partial + String(chunk)).split('\n');
        partial = lines.pop() ?? '';
        for (const line of lines) {
            for (const listener of listeners) {
                listener(line);
            }
        }
    });
    let done = null;
    let ended = false;
    const end = () => {
        if (!done && !ended) {
            child.stdin?.end();
        }
        ended = true;
    };
    void exited.then((exit) => {
        done = exit;
    });
    return {
        exited,
        closed,
        write: (line) => {
            if (!done) {
                child.stdin?.write(`${line}\n`);
            }
        },
        end,
        onLine: (handle) => {
            listeners.push(handle);
        },
        async stop(graceMs, signals) {
            end();
            for (const signal of signals) {
                if (done) {
                    return done;
                }
                if (signal && child.pid !== undefined) {
                    send(child.pid, signal);
                }
                await Promise.race([exited, wait(graceMs)]);
            }
            return exited;
        },
        stderr: () => stderr
    };
}
function send(pid, signal) {
    try {
        process.kill(pid, signal);
    }
    catch {
    }
}
function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function agentEnv(home, keyEnv, key) {
    const env = execEnv(process.env, process.platform);
    if (home) {
        env.HOME = home;
        env.CODEX_HOME = path.join(home, 'codex');
        env.CLAUDE_CONFIG_DIR = path.join(home, 'claude');
    }
    if (keyEnv && key) {
        env[keyEnv] = key;
    }
    return env;
}
