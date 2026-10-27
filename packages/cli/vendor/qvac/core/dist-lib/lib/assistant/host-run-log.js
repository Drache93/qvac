import { RunLog } from '@qvac/harness/run-log';
import { isRecord } from '../guards.js';
import { isChatMessage } from '../run-replay.js';
export function createHostRunLogAdapter(engine) {
    let leased = null;
    return {
        begin(runId) {
            if (leased?.runId !== runId) {
                leased = { runId, lease: open(engine, runId) };
            }
            return leased.lease;
        },
        async append(runId, generation, step) {
            await engine.hostRunLogAppend({ runId, generation, step });
        },
        async release(runId, generation) {
            await engine.hostRunLogRelease({ runId, generation });
        }
    };
}
async function open(engine, runId) {
    const { generation, digestKey, steps } = await engine.hostRunLogBegin({ runId });
    const logged = Array.isArray(steps) ? steps : [];
    return logged.length > 0
        ? { generation, digestKey, boot: bootFrom(logged) }
        : { generation, digestKey };
}
function bootFrom(steps) {
    return steps.reduce((boot, step) => RunLog.applyEngineStep(boot, step), RunLog.createEngineBoot());
}
export function loggedMessages(boot) {
    const request = boot?.metadata ? RunLog.requestFromBoot(boot) : null;
    return isRecord(request) && Array.isArray(request.messages)
        ? request.messages.filter(isChatMessage)
        : null;
}
