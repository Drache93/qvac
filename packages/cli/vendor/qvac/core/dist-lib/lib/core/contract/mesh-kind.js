import { liveDeviceForWriter, trackActivity } from './activity.js';
import { accountMember } from './members.js';
import b4a from 'b4a';
import { MESH_KINDS } from '../collections.js';
const ROW = 'mesh';
export async function meshKind(tx) {
    const row = await tx.get(MESH_KINDS, { id: ROW });
    return row?.kind ?? null;
}
export async function accountKind(tx) {
    const kind = await meshKind(tx);
    return kind === null || kind === 'account' || kind === 'public';
}
export async function sharedKind(tx) {
    const kind = await meshKind(tx);
    return kind === 'shared' || kind === 'workspace' || kind === 'project';
}
async function mayMint(kind, { tx, host, node }) {
    if (kind === 'shared' || kind === 'public' || kind === 'workspace' || kind === 'project') {
        return host.genesis;
    }
    if (kind !== 'account') {
        return false;
    }
    const memberId = (await liveDeviceForWriter(tx, node.key))?.memberId;
    if (!memberId) {
        return false;
    }
    const own = await accountMember(tx);
    return !!own && b4a.equals(own, memberId);
}
export function registerMeshKindRoutes(router) {
    router.add('@qvac/mint-mesh-kind', trackActivity(async ({ kind }, context) => {
        const { tx, log } = context;
        const existing = await tx.get(MESH_KINDS, { id: ROW });
        if (existing) {
            log?.debug('contract', 'mint-mesh-kind dropped: a kind is minted once', {
                kind: existing.kind
            });
            return;
        }
        if (!(await mayMint(kind, context))) {
            log?.warn('contract', 'mint-mesh-kind dropped: not a shared mesh, workspace or project birth, or a member sealing', {
                kind
            });
            return;
        }
        const row = { id: ROW, kind };
        await tx.insert(MESH_KINDS, row);
        log?.info('contract', 'mesh kind stamped', { kind });
        return row;
    }));
}
