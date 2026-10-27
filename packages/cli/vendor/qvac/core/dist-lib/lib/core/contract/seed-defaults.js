import { trackActivity } from './activity.js';
import { WORKSPACES_RULES, rulesVersion } from './mesh-rules.js';
import { AGENTS, CHATS, MESH_BLIND_PEERS } from '../collections.js';
async function seedsChat({ role = 'account' }, tx) {
    return role !== 'account' || (await rulesVersion(tx)) < WORKSPACES_RULES;
}
export function registerSeedDefaultsRoutes(router, options = {}) {
    router.add('@qvac/seed-defaults', trackActivity(async (op, { tx, log }) => {
        let seeded = false;
        if (!(await tx.get(AGENTS, { id: op.agent.id }))) {
            await tx.insert(AGENTS, op.agent);
            log?.debug('contract', 'seeded default agent', {
                id: op.agent.id,
                model: op.agent.modelName
            });
            seeded = true;
        }
        if ((await seedsChat(options, tx)) && !(await tx.get(CHATS, { id: op.chat.id }))) {
            await tx.insert(CHATS, op.chat);
            log?.debug('contract', 'seeded first chat', { id: op.chat.id });
            seeded = true;
        }
        for (const peer of op.blindPeers ?? []) {
            if (!(await tx.get(MESH_BLIND_PEERS, { key: peer.key }))) {
                await tx.insert(MESH_BLIND_PEERS, peer);
                seeded = true;
            }
        }
        return seeded;
    }));
}
export function registerMeshBlindPeerRoutes(router) {
    router.add('@qvac/put-mesh-blind-peer', trackActivity(async (peer, { tx }) => {
        if (await tx.get(MESH_BLIND_PEERS, { key: peer.key })) {
            return;
        }
        await tx.insert(MESH_BLIND_PEERS, peer);
        return peer;
    }));
}
