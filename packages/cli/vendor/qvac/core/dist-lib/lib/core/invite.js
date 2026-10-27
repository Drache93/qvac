import * as z32 from 'z32';
import { decode as decodeStruct, encode as encodeStruct } from '../../spec/mesh/hyperschema/index.js';
const INVITE_STRUCT = '@qvac/mesh-invite';
const MEMBER_INVITE_PREFIX = 'qvac://workspace/';
const DEVICE_INVITE_PREFIX = 'qvac://device/';
const LEGACY_INVITE_PREFIX = 'qvac://mesh/';
const INVITE_PREFIXES = [MEMBER_INVITE_PREFIX, DEVICE_INVITE_PREFIX, LEGACY_INVITE_PREFIX];
export function encodeMeshInvite(invite) {
    const payload = {
        meshKey: invite.baseKey,
        seed: invite.seed,
        fastForward: invite.fastForward,
        additionalNodes: [...(invite.additionalNodes ?? [])],
        blindPeers: [...(invite.blindPeers ?? [])],
        memberInvite: invite.memberInvite ?? false,
        memberId: invite.memberId ?? null,
        inviteNonce: invite.inviteNonce ?? null,
        compute: invite.compute ?? false,
        inviterName: invite.inviterName ?? null,
        deviceSeed: invite.deviceSeed ?? null,
        deviceProof: invite.deviceProof ?? null,
        workspace: invite.workspace ?? false,
        workspaceName: invite.workspaceName ?? null
    };
    const prefix = invite.memberInvite ? MEMBER_INVITE_PREFIX : DEVICE_INVITE_PREFIX;
    return prefix + z32.encode(encodeStruct(INVITE_STRUCT, payload));
}
export function decodeMeshInvite(raw) {
    const value = raw.trim().toLowerCase();
    const prefix = INVITE_PREFIXES.find((p) => value.startsWith(p));
    if (!prefix) {
        return null;
    }
    let payload;
    try {
        payload = decodeStruct(INVITE_STRUCT, z32.decode(value.slice(prefix.length)));
    }
    catch {
        return null;
    }
    return {
        baseKey: payload.meshKey,
        seed: payload.seed,
        fastForward: payload.fastForward ? payload.fastForward : null,
        additionalNodes: (payload.additionalNodes ?? []).map((node) => ({
            host: node.host,
            port: node.port
        })),
        blindPeers: payload.blindPeers ?? [],
        memberInvite: payload.memberInvite ?? false,
        memberId: payload.memberId ?? undefined,
        inviteNonce: payload.inviteNonce ?? undefined,
        compute: payload.compute ?? false,
        inviterName: payload.inviterName ?? undefined,
        deviceSeed: payload.deviceSeed ?? undefined,
        deviceProof: payload.deviceProof ?? undefined,
        workspace: payload.workspace ?? false,
        workspaceName: payload.workspaceName ?? undefined
    };
}
