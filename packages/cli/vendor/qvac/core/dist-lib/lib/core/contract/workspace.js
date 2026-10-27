import { liveDeviceForWriter, trackActivity } from './activity.js';
import { meshKind } from './mesh-kind.js';
import { WORKSPACES_RULES, bornUnderRules, rulesVersion } from './mesh-rules.js';
import b4a from 'b4a';
import { removedBy } from './invites.js';
import { hostsLiveAgent, readPublicSeed } from './public-seeds.js';
import { SEALED_SEED_BYTES } from '../device-seal.js';
import { DEVICES, MEMBER_KEYS, MEMBER_ROLES, MEMBERS, MESH_FOUNDERS, MESH_KINDS, PUBLIC_SEEDS, WORKSPACE } from '../collections.js';
export const WORKSPACE_ROW = 'workspace';
export const WORKSPACE_ROLES = new Set(['admin', 'member']);
export function readWorkspace(tx) {
    return tx.get(WORKSPACE, { id: WORKSPACE_ROW });
}
export async function dropRole(tx, memberId) {
    await tx.delete(MEMBER_ROLES, { memberId });
}
export async function memberRole(tx, memberId) {
    const row = await tx.get(MEMBER_ROLES, { memberId });
    return row?.role === 'admin' ? 'admin' : 'member';
}
export async function admitAdmin(tx, memberId) {
    if (await tx.get(MEMBER_ROLES, { memberId })) {
        return;
    }
    await tx.insert(MEMBER_ROLES, { memberId, role: 'admin' });
}
async function signerMember({ tx, node }) {
    return (await liveDeviceForWriter(tx, node.key))?.memberId ?? null;
}
export async function adminSigner(context) {
    const memberId = await signerMember(context);
    if (!memberId || (await memberRole(context.tx, memberId)) !== 'admin') {
        return null;
    }
    return memberId;
}
export async function isWorkspace(tx) {
    return (await meshKind(tx)) === 'workspace';
}
export async function actsFor(context, owner) {
    if (!(await isWorkspace(context.tx))) {
        return true;
    }
    const signer = await signerMember(context);
    if (!signer) {
        return false;
    }
    return ((!!owner && b4a.equals(signer, owner)) || (await memberRole(context.tx, signer)) === 'admin');
}
function ownerOf(device) {
    return device.memberId ?? device.claimedMemberId ?? null;
}
export async function liveMemberIds(tx) {
    const live = new Set();
    for await (const device of tx.find(DEVICES)) {
        const owner = device.revoked ? null : ownerOf(device);
        if (owner) {
            live.add(b4a.toHex(owner));
        }
    }
    return live;
}
export async function departedMembers(tx) {
    const live = await liveMemberIds(tx);
    const last = new Map();
    for await (const device of tx.find(DEVICES)) {
        const memberId = device.revoked ? ownerOf(device) : null;
        const hex = memberId ? b4a.toHex(memberId) : '';
        if (!memberId || live.has(hex)) {
            continue;
        }
        if ((device.revokedAt ?? 0) >= (last.get(hex)?.device.revokedAt ?? 0)) {
            last.set(hex, { memberId, device });
        }
    }
    const departed = [];
    for (const { memberId, device } of last.values()) {
        const kicked = (await removedBy(tx, device)) === 'another-member';
        departed.push({ memberId, at: device.revokedAt ?? 0, kicked });
    }
    return departed;
}
export async function lastAdminAmongOthers(tx, admin) {
    if ((await memberRole(tx, admin)) !== 'admin') {
        return false;
    }
    let others = false;
    for (const hex of await liveMemberIds(tx)) {
        if (hex === b4a.toHex(admin))
            continue;
        if ((await memberRole(tx, b4a.from(hex, 'hex'))) === 'admin') {
            return false;
        }
        others = true;
    }
    return others;
}
export async function adminsLastDevice(tx, device) {
    const owner = ownerOf(device);
    if (device.revoked || !owner || (await memberRole(tx, owner)) !== 'admin') {
        return false;
    }
    for await (const other of tx.find(DEVICES)) {
        const theirs = ownerOf(other);
        if (!other.revoked && theirs && b4a.equals(theirs, owner) && !b4a.equals(other.id, device.id)) {
            return false;
        }
    }
    return true;
}
export async function leavesNoAdmin(context, memberId) {
    if (!(await isWorkspace(context.tx))) {
        return false;
    }
    const signer = await signerMember(context);
    return (!!signer && b4a.equals(signer, memberId) && (await lastAdminAmongOthers(context.tx, memberId)));
}
export async function kicksAdminsLastDevice(context, deviceId) {
    if (!deviceId || !(await isWorkspace(context.tx))) {
        return false;
    }
    const device = await context.tx.get(DEVICES, { id: deviceId });
    const owner = device && ownerOf(device);
    const signer = await signerMember(context);
    if (!device || !owner || (signer && b4a.equals(signer, owner))) {
        return false;
    }
    return adminsLastDevice(context.tx, device);
}
async function bornWorkspace({ workspace }, context) {
    const { tx, host, log } = context;
    if (!host.genesis || (await meshKind(tx)) !== 'workspace') {
        log?.warn('contract', 'put-workspace dropped: not a workspace genesis');
        return;
    }
    const founder = await tx.get(MESH_FOUNDERS, { id: 'mesh' });
    if (!founder) {
        log?.warn('contract', 'put-workspace dropped: the genesis founded no member to be its admin');
        return;
    }
    const row = { ...workspace, id: WORKSPACE_ROW, upgradeMemberIds: undefined };
    await tx.insert(WORKSPACE, row);
    await tx.insert(MEMBER_ROLES, { memberId: founder.memberId, role: 'admin' });
    log?.info('contract', 'workspace born');
    return row;
}
async function editedWorkspace(existing, { workspace }, context) {
    const { tx, log } = context;
    if (!(await adminSigner(context))) {
        log?.warn('contract', 'put-workspace dropped: only an admin edits the workspace');
        return;
    }
    if (workspace.updatedAt <= existing.updatedAt) {
        log?.debug('contract', 'put-workspace dropped: not newer than the stored row');
        return;
    }
    const { upgradeMemberIds } = existing;
    const row = { ...workspace, id: WORKSPACE_ROW, upgradeMemberIds };
    await tx.insert(WORKSPACE, row);
    return row;
}
async function setMemberRole({ memberId, role }, context) {
    const { tx, log } = context;
    if (!WORKSPACE_ROLES.has(role)) {
        log?.warn('contract', 'set-member-role dropped: unknown role', { role });
        return;
    }
    const signer = await adminSigner(context);
    if (!signer) {
        log?.warn('contract', 'set-member-role dropped: only an admin changes a role');
        return;
    }
    if (b4a.equals(signer, memberId)) {
        log?.warn('contract', 'set-member-role dropped: an admin cannot change their own role');
        return;
    }
    if (!(await tx.get(MEMBERS, { id: memberId }))) {
        log?.debug('contract', 'set-member-role dropped: unknown member');
        return;
    }
    const row = { memberId, role };
    await tx.insert(MEMBER_ROLES, row);
    return row;
}
async function anotherMembersHost(tx, op) {
    const host = await tx.get(DEVICES, { id: op.deviceId });
    if (!host || host.revoked || !host.memberId || b4a.equals(host.memberId, op.memberId)) {
        return false;
    }
    return hostsLiveAgent(tx, op.deviceId);
}
async function putPublicSeed(op, context) {
    const { tx, log } = context;
    if (!(await isWorkspace(tx))) {
        log?.warn('contract', 'put-public-seed dropped: not a workspace');
        return;
    }
    const signer = await signerMember(context);
    if (!signer || !b4a.equals(signer, op.memberId)) {
        log?.warn('contract', 'put-public-seed dropped: the writer is no device of this member');
        return;
    }
    if (!(await tx.get(MEMBERS, { id: op.memberId }))) {
        log?.debug('contract', 'put-public-seed dropped: unknown member');
        return;
    }
    if (op.sealedSeed.byteLength !== SEALED_SEED_BYTES) {
        log?.warn('contract', 'put-public-seed dropped: not a sealed seed');
        return;
    }
    if (!(await anotherMembersHost(tx, op))) {
        log?.warn('contract', "put-public-seed dropped: not another member's live agent host");
        return;
    }
    const held = await readPublicSeed(tx, op.memberId, op.deviceId);
    if (held && b4a.equals(held.publicMeshKey, op.publicMeshKey)) {
        return;
    }
    const row = {
        memberId: op.memberId,
        deviceId: op.deviceId,
        publicMeshKey: op.publicMeshKey,
        sealedSeed: op.sealedSeed
    };
    await tx.insert(PUBLIC_SEEDS, row);
    return row;
}
export function readMemberKey(tx, memberId) {
    return tx.get(MEMBER_KEYS, { memberId });
}
async function putMemberKey(op, context) {
    const { tx, log } = context;
    if (!(await isWorkspace(tx))) {
        log?.warn('contract', 'put-member-key dropped: not a workspace');
        return;
    }
    const signer = await signerMember(context);
    if (!signer || !b4a.equals(signer, op.memberId)) {
        log?.warn('contract', 'put-member-key dropped: the writer is no device of this member');
        return;
    }
    if (!(await tx.get(MEMBERS, { id: op.memberId }))) {
        log?.debug('contract', 'put-member-key dropped: unknown member');
        return;
    }
    const held = await readMemberKey(tx, op.memberId);
    if (held && b4a.equals(held.boxKey, op.boxKey)) {
        return;
    }
    const row = { memberId: op.memberId, boxKey: op.boxKey };
    await tx.insert(MEMBER_KEYS, row);
    return row;
}
async function upgradeToWorkspace({ upgradedAt }, context) {
    const { tx, log } = context;
    const kind = await meshKind(tx);
    const onRules = (await rulesVersion(tx)) >= WORKSPACES_RULES;
    if (!onRules || (kind !== 'shared' && kind !== 'workspace') || (await bornUnderRules(tx))) {
        log?.debug('contract', 'upgrade-to-workspace dropped: not a shared mesh born before the rules');
        return;
    }
    const signer = await signerMember(context);
    if (!signer || !(await tx.get(MEMBERS, { id: signer }))) {
        log?.warn('contract', 'upgrade-to-workspace dropped: the writer speaks for no member here');
        return;
    }
    if (kind === 'workspace') {
        return countUpgrader(tx, signer, context);
    }
    const upgradeMemberIds = [];
    for (const hex of await liveMemberIds(tx)) {
        const memberId = b4a.from(hex, 'hex');
        if (await tx.get(MEMBERS, { id: memberId })) {
            upgradeMemberIds.push(memberId);
            await admitAdmin(tx, memberId);
        }
    }
    await tx.insert(MESH_KINDS, { id: 'mesh', kind: 'workspace' });
    const row = { id: WORKSPACE_ROW, updatedAt: upgradedAt, upgradeMemberIds };
    await tx.insert(WORKSPACE, row);
    log?.info('contract', 'shared mesh upgraded to a workspace');
    return row;
}
async function countUpgrader(tx, signer, { log }) {
    const row = await tx.get(WORKSPACE, { id: WORKSPACE_ROW });
    const counted = row?.upgradeMemberIds ?? [];
    if (!row || counted.some((id) => b4a.equals(id, signer))) {
        log?.debug('contract', 'upgrade-to-workspace dropped: its signer is counted already');
        return;
    }
    const grown = { ...row, upgradeMemberIds: [...counted, signer] };
    await tx.insert(WORKSPACE, grown);
    log?.info('contract', 'a member the upgrade missed is counted');
    return grown;
}
export async function uncountMember(tx, memberId) {
    const row = await tx.get(WORKSPACE, { id: WORKSPACE_ROW });
    const counted = row?.upgradeMemberIds ?? [];
    if (row && counted.some((id) => b4a.equals(id, memberId))) {
        const upgradeMemberIds = counted.filter((id) => !b4a.equals(id, memberId));
        await tx.insert(WORKSPACE, { ...row, upgradeMemberIds });
    }
}
export async function upgradeMembers(tx) {
    const row = await tx.get(WORKSPACE, { id: WORKSPACE_ROW });
    return row?.upgradeMemberIds ?? [];
}
export function registerWorkspaceRoutes(router) {
    router.add('@qvac/put-workspace', trackActivity(async (op, context) => {
        const existing = await readWorkspace(context.tx);
        return existing ? editedWorkspace(existing, op, context) : bornWorkspace(op, context);
    }));
    router.add('@qvac/set-member-role', trackActivity(setMemberRole));
    router.add('@qvac/put-public-seed', trackActivity(putPublicSeed));
    router.add('@qvac/put-member-key', trackActivity(putMemberKey));
    router.add('@qvac/upgrade-to-workspace', trackActivity(upgradeToWorkspace));
}
