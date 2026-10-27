import { didDrainTimeOut, raceDrain } from '../helpers/drain.js';
import { applyEngineStep, captureEngineStep, captureRunRecord, createEngineStep, prepareEngineBoot } from './protocol.js';
import { ENGINE_BOUNDARY_BOOT, RunJournal } from './run-journal.js';
export const HOST_APPEND_TIMEOUT_MS = 5000;
export function openBoundaryJournal(options, runId) {
    const log = boundaryLog(options, runId);
    return new RunJournal(log, {
        boot: log[ENGINE_BOUNDARY_BOOT](),
        redact: options.redact,
        redactShared: options.redactShared,
        redactOperationResult: options.redactOperationResult,
        redactRecord: options.redactRecord
    });
}
export function boundaryBoot(journal) {
    return prepareEngineBoot(getCurrentBoot(journal.core, journal));
}
function boundaryLog(options, runId) {
    let boot = prepareEngineBoot(options.boot);
    const log = {
        [ENGINE_BOUNDARY_BOOT]: () => boot,
        get length() {
            return boot.length;
        },
        ready: async () => { },
        get: async () => {
            return null;
        },
        async append(value) {
            const step = createEngineStep(boot.nextSeq, boot.length, [captureRunRecord(value)]);
            const prepared = options.redactStep ? captureEngineStep(options.redactStep(step)) : step;
            const next = applyEngineStep(boot, prepared);
            const append = options.onStep?.(prepared);
            if (append) {
                const configured = options.hostAppendTimeoutMs;
                const timeoutMs = typeof configured === 'number' && Number.isFinite(configured) && configured > 0
                    ? Math.min(configured, 2 ** 31 - 1)
                    : HOST_APPEND_TIMEOUT_MS;
                const acknowledged = await raceDrain(append, timeoutMs);
                if (didDrainTimeOut(acknowledged)) {
                    try {
                        options.onDetached?.(append, runId);
                    }
                    catch {
                    }
                    throw new Error(`Host run-log append did not acknowledge within ${timeoutMs}ms`);
                }
            }
            boot = next;
            return boot;
        }
    };
    return log;
}
function getCurrentBoot(log, journal) {
    const readBoot = Reflect.get(log, ENGINE_BOUNDARY_BOOT);
    return typeof readBoot === 'function' ? readBoot.call(log) : journal.exportBoot();
}
