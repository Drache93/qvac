import { WORKSPACE_ROLES, memberRole } from '../core/contract/workspace.js';
import { meshWatchable, requireMesh } from './current-mesh.js';
import b4a from 'b4a';
import { DEVICES, MEMBERS } from '../core/collections.js';
import { CoreError } from '../errors.js';
const RESOLVE_MEMBER_MS = 10_000;
async function resolveOurMember(mesh) {
    let timer = null;
    try {
        await Promise.race([
            mesh.autobee.update().then(() => mesh.refreshOurMember()),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new CoreError('MEMBER_RESOLVE_TIMEOUT')), RESOLVE_MEMBER_MS);
            })
        ]);
    }
    finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}
export async function requireOurMember(mesh) {
    if (!mesh.ourMemberId) {
        await resolveOurMember(mesh);
    }
    if (!mesh.ourMemberId) {
        throw new CoreError('OWN_MEMBER_UNKNOWN', ['this mesh']);
    }
    return mesh.ourMemberId;
}
export function requireWorkspace(mesh, meshId) {
    if (mesh.role !== 'workspace') {
        throw new CoreError('NOT_A_WORKSPACE', [meshId]);
    }
}
export async function requireOurAdmin(mesh, action) {
    if (!mesh.ourMemberId) {
        await resolveOurMember(mesh);
    }
    const ours = mesh.ourMemberId;
    if (!ours || (await memberRole(mesh.view, ours)) !== 'admin') {
        throw new CoreError('WORKSPACE_ADMIN_ONLY', [action]);
    }
    return ours;
}
async function toEngineMember(reader, { mesh, member, removed }) {
    const role = mesh.role === 'workspace' ? await memberRole(reader, member.id) : undefined;
    return { id: member.id, name: member.name, joinedAt: member.joinedAt, removed, role };
}
async function liveMemberIds(snap) {
    const live = new Set();
    for await (const device of snap.find(DEVICES)) {
        const owner = device.revoked ? null : (device.memberId ?? device.claimedMemberId);
        if (owner) {
            live.add(b4a.toHex(owner));
        }
    }
    return live;
}
export function createMembersApi(pool, self, { state, log }) {
    const mustGetMember = async (reader, id) => {
        const member = await reader.get(MEMBERS, { id });
        if (!member) {
            throw new CoreError('MEMBER_NOT_FOUND', [b4a.toHex(id)]);
        }
        return member;
    };
    const list = async (mesh) => {
        const snap = mesh.view.snapshot();
        try {
            const live = await liveMemberIds(snap);
            const members = [];
            for await (const member of snap.find(MEMBERS)) {
                const removed = !live.has(b4a.toHex(member.id));
                members.push(await toEngineMember(snap, { mesh, member, removed }));
            }
            return { members };
        }
        finally {
            await snap.close();
        }
    };
    const readMember = async (mesh, id) => {
        const snap = mesh.view.snapshot();
        try {
            const member = await mustGetMember(snap, id);
            const removed = !(await liveMemberIds(snap)).has(b4a.toHex(id));
            return await toEngineMember(snap, { mesh, member, removed });
        }
        finally {
            await snap.close();
        }
    };
    return {
        listMembers: async (request) => list(await requireMesh(pool, request.meshId)),
        membersWatch: meshWatchable(pool, (_request, mesh) => list(mesh), { name: 'membersWatch', log }),
        updateMember: async ({ config }) => {
            const trimmed = config.name.trim();
            if (!trimmed) {
                throw new CoreError('MEMBER_NAME_EMPTY');
            }
            const { meshId } = await self.account();
            if (!meshId) {
                throw new CoreError('MEMBER_RENAME_NO_ACCOUNT');
            }
            const mesh = await requireMesh(pool, meshId);
            if (!mesh.ourMemberId) {
                await resolveOurMember(mesh);
            }
            const id = mesh.ourMemberId;
            if (!id) {
                throw new CoreError('OWN_MEMBER_UNKNOWN', ['its account']);
            }
            const member = await mustGetMember(mesh.view, id);
            const namedAt = Math.max(Date.now(), member.updatedAt + 1);
            await state?.saveDisplayName(trimmed, namedAt);
            await mesh.dispatch('update-member', {
                member: { ...member, name: trimmed, updatedAt: namedAt }
            });
            return readMember(mesh, id);
        },
        removeMember: async ({ memberId: id, meshId }) => {
            const mesh = await requireMesh(pool, meshId);
            if (!mesh.ourMemberId) {
                await resolveOurMember(mesh);
            }
            if (!mesh.ourMemberId) {
                throw new CoreError('OWN_MEMBER_UNKNOWN', ['this mesh']);
            }
            if (b4a.equals(mesh.ourMemberId, id)) {
                throw new CoreError('MEMBER_REMOVE_SELF');
            }
            if (mesh.role === 'workspace') {
                await requireOurAdmin(mesh, 'remove a member');
            }
            await mesh.dispatch('remove-member', { memberId: id, revokedAt: Date.now() });
            return { ok: true };
        },
        setMemberRole: async ({ meshId, memberId, config }) => {
            if (!WORKSPACE_ROLES.has(config.role)) {
                throw new CoreError('MEMBER_ROLE_UNKNOWN', [config.role]);
            }
            const mesh = await requireMesh(pool, meshId);
            requireWorkspace(mesh, meshId);
            const ours = await requireOurAdmin(mesh, 'change a role');
            if (b4a.equals(ours, memberId)) {
                throw new CoreError('MEMBER_ROLE_SELF');
            }
            await mustGetMember(mesh.view, memberId);
            await mesh.dispatch('set-member-role', { memberId, role: config.role });
            return readMember(mesh, memberId);
        }
    };
}
