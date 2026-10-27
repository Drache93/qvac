import process from 'process';
import { spawnEnv } from '../../helpers/spawn-path.js';
export async function bareRuntime() {
    const { spawn } = await import('child_process');
    const rawSpawn = spawn;
    const spawnFn = (command, opts = {}) => rawSpawn(command, { ...opts, env: spawnEnv(process.env, process.platform, opts.env) });
    return { spawn: spawnFn, killProcess: process.kill.bind(process) };
}
