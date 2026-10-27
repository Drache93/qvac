import { MESH_RULES } from '../collections.js';
import { CoreError } from '../../errors.js';
export const MESH_RULES_ROW = 'mesh';
export const WORKSPACES_RULES = 1;
export const KNOWN_RULES = WORKSPACES_RULES;
export async function rulesVersion(tx) {
    const row = await tx.get(MESH_RULES, { id: MESH_RULES_ROW });
    return row?.rules ?? 0;
}
export async function bornUnderRules(tx) {
    const row = await tx.get(MESH_RULES, { id: MESH_RULES_ROW });
    return !!row?.atGenesis;
}
export function registerMeshRulesRoutes(router) {
    router.add('@qvac/raise-mesh-rules', async ({ rules }, { tx, host, log }) => {
        const existing = await tx.get(MESH_RULES, { id: MESH_RULES_ROW });
        const held = existing?.rules ?? 0;
        if (rules <= held) {
            log?.debug('contract', 'raise-mesh-rules dropped: the rules only rise', { rules, held });
            return;
        }
        if (rules > KNOWN_RULES) {
            throw new CoreError('MESH_RULES_FROM_A_NEWER_BUILD', [rules, KNOWN_RULES]);
        }
        const atGenesis = existing ? existing.atGenesis : host.genesis;
        const row = { id: MESH_RULES_ROW, rules, atGenesis: atGenesis || undefined };
        await tx.insert(MESH_RULES, row);
        log?.info('contract', 'mesh rules raised', { rules });
        return row;
    });
}
