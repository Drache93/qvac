import { Readable } from 'streamx';
import { frameReadable } from './frame-readable.js';
import { asError } from './guards.js';
const RETRY_MIN_MS = 250;
const RETRY_MAX_MS = 5_000;
export function reconnectingWatch(open, onDisconnect) {
    let closeConnection = null;
    let retry = null;
    let retryMs = RETRY_MIN_MS;
    let output;
    const schedule = (error) => {
        if (output.destroying)
            return;
        onDisconnect(error);
        retry = setTimeout(() => {
            retry = null;
            connect();
        }, retryMs);
        retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    };
    const connect = () => {
        if (output.destroying)
            return;
        let source;
        try {
            source = open();
        }
        catch (error) {
            schedule(asError(error));
            return;
        }
        const close = () => {
            source.off('data', onData);
            source.off('error', onError);
            source.off('end', onEnd);
            source.off('close', onEnd);
            source.destroy();
        };
        const disconnect = (error) => {
            if (closeConnection !== close)
                return;
            closeConnection = null;
            close();
            schedule(error);
        };
        const onData = (frame) => {
            retryMs = RETRY_MIN_MS;
            output.push(frame);
        };
        const onError = (error) => disconnect(error);
        const onEnd = () => disconnect(new Error('Watch stream ended unexpectedly'));
        closeConnection = close;
        source.on('data', onData);
        source.on('error', onError);
        source.on('end', onEnd);
        source.on('close', onEnd);
    };
    output = new Readable({
        open(cb) {
            connect();
            cb(null);
        },
        read(cb) {
            cb(null);
        },
        destroy(cb) {
            if (retry) {
                clearTimeout(retry);
            }
            retry = null;
            const close = closeConnection;
            closeConnection = null;
            close?.();
            cb(null);
        }
    });
    return frameReadable(output);
}
