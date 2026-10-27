import { watchable } from './watchable.js';
async function readDownloads(state) {
    const rows = await state.getModelDownloadRows();
    return {
        downloads: rows.map((row) => ({
            name: row.name,
            phase: row.phase,
            percentage: row.percentage ?? 0,
            error: row.error ?? null,
            updatedAt: row.updatedAt,
            downloaded: row.downloaded ?? 0,
            total: row.total ?? 0,
            bytesPerSecond: row.bytesPerSecond ?? 0
        }))
    };
}
export function createModelDownloadApi(state, log) {
    return {
        beginModelTransfer: async ({ name, transferred }) => {
            const { transferId } = await state.beginModelTransfer(name, { transferred });
            return { name, transferId };
        },
        completeModelTransfer: async (request) => {
            await state.completeModelTransfer(request);
            return { ok: true };
        },
        modelDownloadsWatch: watchable(() => state, () => readDownloads(state), { name: 'modelDownloadsWatch', log }),
        setModelDownloadStatus: async (input) => {
            const row = {
                name: input.name,
                phase: input.phase,
                percentage: input.percentage ?? 0,
                error: input.error ?? null,
                updatedAt: Date.now(),
                downloaded: input.downloaded ?? 0,
                total: input.total ?? 0,
                bytesPerSecond: input.bytesPerSecond ?? 0
            };
            await state.putModelDownloadRow(row);
            return { ok: true };
        },
        clearModelDownload: async ({ name }) => {
            await state.deleteModelDownloadRow(name);
            return { ok: true };
        }
    };
}
