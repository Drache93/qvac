import { watchable } from './watchable.js';
import { CoreError } from '../errors.js';
export function createMeshApi(status, updateMember, log) {
    return {
        meshStatusWatch: watchable(() => status, async () => status.snapshot(), { name: 'meshStatusWatch', log }),
        listMeshes: () => status.list(),
        meshesWatch: watchable(() => status, () => status.list(), { name: 'meshesWatch', log }),
        account: () => status.account(),
        accountWatch: watchable(() => status, () => status.account(), { name: 'accountWatch', log }),
        openMesh: async ({ meshId }) => {
            await status.open(meshId);
            return { ok: true };
        },
        closeMesh: async ({ meshId }) => {
            await status.close(meshId);
            return { ok: true };
        },
        leaveMesh: async ({ meshId }) => {
            await status.leave(meshId);
            return { ok: true };
        },
        acknowledgeKicked: async () => {
            status.acknowledgeKicked();
            return { ok: true };
        },
        joinMesh: async ({ invite }) => {
            await status.join(invite);
            return { ok: true };
        },
        cancelMeshJoin: async () => {
            status.cancelJoin();
            return { ok: true };
        },
        previewMeshInvite: ({ invite }) => status.preview(invite),
        meshInvite: async ({ member, meshId }) => status.invite(member ?? false, meshId ?? undefined),
        setMeshLabel: async ({ meshId, label }) => {
            await status.label(meshId, label ?? '');
            return { ok: true };
        },
        setMeshName: async ({ meshId, name }) => {
            await status.name(meshId, name ?? '');
            return { ok: true };
        },
        createMesh: async (request) => ({
            meshId: await status.createMesh({ compute: request?.config?.compute })
        }),
        createRoom: async () => {
            throw new CoreError('ROUTE_RETIRED', ['createRoom', 'createMesh']);
        },
        listArchivedMeshes: () => status.listArchived(),
        archivedMeshContents: ({ meshId }) => status.archivedContents(meshId),
        migrateArchivedMesh: ({ meshId }) => status.migrateArchived(meshId),
        accountRecoverable: async () => ({
            recoverable: await status.recoverable()
        }),
        recoveryPublish: async ({ phrase }) => {
            await status.publishRecovery(phrase);
            return { recoverable: await status.recoverable() };
        },
        recoverAccount: async ({ phrase, timeout }) => {
            await status.recover(phrase, timeout || undefined);
            return { ok: true };
        },
        displayName: async () => ({
            name: await status.displayName()
        }),
        setDisplayName: async ({ name }) => {
            await updateMember({ config: { name: name ?? '' } });
            return { ok: true };
        }
    };
}
