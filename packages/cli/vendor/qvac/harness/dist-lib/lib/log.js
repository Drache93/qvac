import QvacLogger, {} from '@qvac/logging';
import { ENV_LOG_LEVEL, LEVEL_PRIORITIES } from '@qvac/logging/constants';
import process from 'process';
const HOST_SCOPE = 'harness-client';
let sink = null;
let host = null;
const logger = new QvacLogger({
    level: 'debug',
    error: writer('error'),
    warn: writer('warn'),
    info: writer('info'),
    debug: writer('debug')
});
const fromEnv = envLevel();
let configured = logger.getLevel();
if (process.env.QVAC_HARNESS_LOG !== '1') {
    logger.setLevel('off');
}
export class HarnessLog {
    static error(message, data) {
        logger.error(message, data);
    }
    static warn(message, data) {
        logger.warn(message, data);
    }
    static info(message, data) {
        logger.info(message, data);
    }
    static debug(message, data) {
        logger.debug(message, data);
    }
    static diag(message, data) {
        if (!sink)
            return;
        sink(format(message, data), 'info');
    }
    static enable(on) {
        logger.setLevel(on ? configured : 'off');
    }
    static setLevel(level) {
        logger.setLevel(level);
    }
    static level() {
        return logger.getLevel();
    }
    static followHost(level) {
        configured = fromEnv ?? (isLevel(level) ? level : 'debug');
        logger.setLevel(configured);
    }
    static toHost(next) {
        host = next;
        if (next) {
            HarnessLog.followHost(next.getLevel?.());
        }
    }
    static isLevel(value) {
        return isLevel(value);
    }
    static enabled(level) {
        const current = logger.getLevel();
        return current !== 'off' && LEVEL_PRIORITIES[level] <= LEVEL_PRIORITIES[current];
    }
    static setSink(next) {
        sink = next;
    }
}
function isLevel(value) {
    return typeof value === 'string' && Object.hasOwn(LEVEL_PRIORITIES, value);
}
function writer(level) {
    return (message, data) => {
        const line = format(message, data);
        if (sink) {
            sink(line, level);
            return;
        }
        if (host) {
            const write = host[level] ?? host.info;
            write.call(host, HOST_SCOPE, line);
            return;
        }
        process.stdout.write(`${line}\n`);
    };
}
function envLevel() {
    const value = process.env[ENV_LOG_LEVEL] || process.env[`EXPO_PUBLIC_${ENV_LOG_LEVEL}`];
    const level = value?.toLowerCase();
    return isLevel(level) ? level : null;
}
function format(message, data) {
    return data === undefined ? message : `${message} ${safeJson(data)}`;
}
function safeJson(data) {
    try {
        return JSON.stringify(data);
    }
    catch {
        return '[unserializable]';
    }
}
