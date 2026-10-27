import b4a from 'b4a';
import { MEMBERS, PROJECT_MEMBERS } from './collections.js';
import { liveMemberIds } from './contract/workspace.js';
export async function projectSenders(workspace, project) {
    const [names, live, inProject] = await Promise.all([
        memberNames(workspace),
        liveMemberIds(workspace),
        projectMemberIds(project)
    ]);
    return { names, live, inProject };
}
export async function ourSenderName(mesh, meshId, lookup) {
    const ours = mesh.ourMemberId ?? (await mesh.refreshOurMember())?.memberId;
    const senders = ours && lookup ? await lookup(meshId) : null;
    return ours ? senders?.names.get(b4a.toHex(ours)) : undefined;
}
export function withSenders(chunks, senders) {
    if (!senders) {
        return [...chunks];
    }
    return chunks.map((chunk) => {
        if (chunk.type !== 'user-message' || !chunk.requesterMemberId) {
            return chunk;
        }
        const writer = chunk.requesterMemberId;
        const sender = chunk.senderMemberId ?? writer;
        const id = b4a.toHex(sender);
        const name = senders.names.get(id);
        const live = senders.live.has(id);
        return {
            ...chunk,
            senderName: name,
            senderNotInProject: live && !senders.inProject.has(id),
            senderFormerMember: name !== undefined && !live,
            senderCopiedBy: b4a.equals(sender, writer) ? undefined : writer
        };
    });
}
async function memberNames(view) {
    const names = new Map();
    for await (const member of view.find(MEMBERS)) {
        names.set(b4a.toHex(member.id), member.name);
    }
    return names;
}
async function projectMemberIds(view) {
    const ids = new Set();
    for await (const row of view.find(PROJECT_MEMBERS)) {
        ids.add(b4a.toHex(row.memberId));
    }
    return ids;
}
