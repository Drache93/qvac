import c from 'compact-encoding';
import b4a from 'b4a';
const CORE_PATH = [48, 7822, 0, 0, 0];
const ENCRYPTION_PATH = ['qvac', 'account-recovery', 'seal'];
const record = {
    preencode(state, r) {
        c.fixed32.preencode(state, r.meshKey);
        c.fixed32.preencode(state, r.seed);
        c.uint.preencode(state, r.createdAt);
    },
    encode(state, r) {
        c.fixed32.encode(state, r.meshKey);
        c.fixed32.encode(state, r.seed);
        c.uint.encode(state, r.createdAt);
    },
    decode(state) {
        return {
            meshKey: b4a.from(c.fixed32.decode(state)),
            seed: b4a.from(c.fixed32.decode(state)),
            createdAt: c.uint.decode(state)
        };
    }
};
export function recoveryKeys(identity) {
    const { keyChain } = identity;
    return {
        coreKeyPair: keyChain.get(CORE_PATH),
        encryptionKey: keyChain.getSymmetricKey(ENCRYPTION_PATH)
    };
}
export function openRecoveryCore(store, keys) {
    return store.get({ keyPair: keys.coreKeyPair, encryptionKey: keys.encryptionKey });
}
export async function publishRecovery(core, next) {
    const current = await readRecovery(core);
    if (current?.meshKey && b4a.equals(current.meshKey, next.meshKey)) {
        return false;
    }
    await core.append(c.encode(record, next));
    return true;
}
export async function readRecovery(core, { timeout } = {}) {
    await core.ready();
    if (core.length === 0) {
        if (timeout === undefined) {
            return null;
        }
        await core.get(0, { timeout });
        await core.update({ wait: true });
    }
    const block = await core.get(core.length - 1);
    return block ? c.decode(record, block) : null;
}
