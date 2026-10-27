import { HarnessError } from './errors.js';
export function settleOnClose(hrpc) {
    const session = hrpc;
    let reason = null;
    const dead = (err) => {
        reason ??= err ?? new HarnessError('RPC_STREAM_DESTROYED');
    };
    const call = session._call.bind(session);
    const callSync = session._callSync.bind(session);
    session._call = (name, args) => (reason ? Promise.reject(reason) : call(name, args));
    session._callSync = (name, args) => {
        if (reason)
            throw reason;
        return callSync(name, args);
    };
    session._stream.on('error', (err) => dead(err));
    session._stream.on('close', () => dead(null));
    if (session._stream.destroyed) {
        dead(null);
    }
    return hrpc;
}
