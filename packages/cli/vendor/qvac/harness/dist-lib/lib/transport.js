import c from 'compact-encoding';
import { Duplex } from 'streamx';
export { settleOnClose } from './rpc-session.js';
export function clientSessions(pipe) {
    let current = session(pipe);
    pipe.on('data', (chunk) => current.push(chunk));
    return {
        get current() {
            return current;
        },
        reset() {
            const previous = current;
            current = session(pipe);
            previous.destroy();
            return current;
        }
    };
}
function session(pipe) {
    return new Duplex({
        write(data, cb) {
            pipe.write(data);
            cb(null);
        }
    });
}
export function duplexPair() {
    let a;
    let b;
    a = new Duplex({
        write(data, cb) {
            b.push(data);
            cb(null);
        },
        final(cb) {
            b.push(null);
            cb(null);
        },
        destroy(cb) {
            b.destroy();
            cb(null);
        }
    });
    b = new Duplex({
        write(data, cb) {
            a.push(data);
            cb(null);
        },
        final(cb) {
            a.push(null);
            cb(null);
        },
        destroy(cb) {
            a.destroy();
            cb(null);
        }
    });
    return [a, b];
}
