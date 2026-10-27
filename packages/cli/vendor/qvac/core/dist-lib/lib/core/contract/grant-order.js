import { INVITE_SEQUENCES, MEMBER_REMOVALS } from '../collections.js';
const ROW = 'mesh';
async function currentSequence(tx) {
    return (await tx.get(INVITE_SEQUENCES, { id: ROW }))?.value ?? 0;
}
export async function nextGrantSequence(tx) {
    const value = (await currentSequence(tx)) + 1;
    await tx.insert(INVITE_SEQUENCES, { id: ROW, value });
    return value;
}
export async function recordMemberRemoval(tx, memberId) {
    await tx.insert(MEMBER_REMOVALS, {
        memberId,
        grantSequence: await currentSequence(tx)
    });
}
export async function removedSinceMint(tx, memberId, grant) {
    const removal = await tx.get(MEMBER_REMOVALS, { memberId });
    return !!removal && (grant.sequence ?? 0) <= removal.grantSequence;
}
