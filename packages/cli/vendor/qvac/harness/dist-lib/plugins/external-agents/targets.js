import fs from 'fs';
import path from 'path';
import { AcpClient, acpTurn } from './acp.js';
import { agentEnv, spawnAgent } from './process.js';
const GRACE_MS = 2_000;
export function graceMs(config) {
    return config.graceMs ?? GRACE_MS;
}
export function targetKey(config) {
    return config.key ? config.key() : Promise.resolve(null);
}
export function agentTarget(config, dir, { argv, drive }) {
    const home = config.login === 'user' ? null : path.join(dir, config.name);
    return {
        name: config.name,
        description: config.description,
        policyVersion: config.login ?? 'isolated',
        async run(task, signal) {
            const key = await targetKey(config);
            if (home) {
                await fs.promises.mkdir(home, { recursive: true });
            }
            if (signal.aborted) {
                return { status: 'aborted', text: '', transcript: [] };
            }
            const child = spawnAgent(config.command, [...(config.args ?? []), ...argv(task, config)], {
                cwd: task.workdir,
                env: agentEnv(home, config.keyEnv, key)
            });
            const live = task.onEvent;
            const onEvent = live && ((event) => live(redact(event, key)));
            const ran = await drive({ config, child, task: { ...task, onEvent }, signal });
            ended(ran, await child.stop(graceMs(config), [null, 'SIGTERM', 'SIGKILL']));
            if (ran.status === 'error') {
                ran.text = [ran.text, child.stderr().trim().slice(-500)].filter(Boolean).join(': ');
            }
            return redact(ran, key);
        }
    };
}
function ended(ran, exit) {
    const last = ran.transcript.at(-1);
    if (last?.type === 'end') {
        last.exit = exit;
    }
    else {
        ran.transcript.push({ type: 'end', exit });
    }
}
function redact(value, key) {
    if (!key) {
        return value;
    }
    const text = JSON.stringify(value).split(JSON.stringify(key).slice(1, -1)).join('[redacted]');
    return JSON.parse(text);
}
export const acpDriver = ({ config, child, task, signal }) => {
    const client = new AcpClient((line) => child.write(line));
    child.onLine((line) => client.receive(line));
    void child.exited.then(() => client.close(new Error('the agent exited')));
    return acpTurn(client, task, {
        signal,
        maxCostUsd: config.maxCostUsd,
        graceMs: graceMs(config)
    });
};
