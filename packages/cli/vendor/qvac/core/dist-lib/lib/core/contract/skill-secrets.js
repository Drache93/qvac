import box from 'sodium-universal/crypto_box.js';
import { SKILL_SECRETS } from '../collections.js';
import { liveDeviceForWriter, trackActivity } from './activity.js';
export const SKILL_SECRET_PREFIX = 'skills.';
const MAX_KEY_CHARS = 512;
const MAX_SEALED_BYTES = 16 * 1024;
async function putSkillSecret(op, { tx, node, log }) {
    if (!(await liveDeviceForWriter(tx, node.key))) {
        log?.warn('contract', 'put-skill-secret dropped: the writer is no live device of the account');
        return;
    }
    if (!op.key.startsWith(SKILL_SECRET_PREFIX) || op.key.length > MAX_KEY_CHARS) {
        log?.warn('contract', 'put-skill-secret dropped: not a skill key');
        return;
    }
    const size = op.sealed.byteLength;
    if (size <= box.crypto_box_SEALBYTES || size > MAX_SEALED_BYTES) {
        log?.warn('contract', 'put-skill-secret dropped: not a sealed value');
        return;
    }
    const existing = await tx.get(SKILL_SECRETS, { key: op.key });
    if (existing && existing.updatedAt >= op.updatedAt) {
        log?.debug('contract', 'put-skill-secret dropped: not newer than the stored value');
        return;
    }
    const row = { key: op.key, sealed: op.sealed, updatedAt: op.updatedAt };
    await tx.insert(SKILL_SECRETS, row);
    return row;
}
export function registerSkillSecretRoutes(router) {
    router.add('@qvac/put-skill-secret', trackActivity(putSkillSecret));
}
