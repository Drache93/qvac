import b4a from 'b4a';
import crypto from 'hypercore-crypto';
import { watchable } from './watchable.js';
import { customModelTaskRefusal } from '../custom-model-task.js';
import { CoreError } from '../errors.js';
export const CUSTOM_MODEL_ID_PREFIX = 'custom:';
export function customModelId(src) {
    return CUSTOM_MODEL_ID_PREFIX + b4a.toHex(crypto.hash(b4a.from(src))).slice(0, 12);
}
async function readCustomModels(state) {
    const rows = await state.getCustomModelRows();
    return {
        models: rows.map((row) => ({
            name: row.name,
            src: row.src,
            mmprojSrc: row.mmprojSrc ?? null,
            supportsTools: row.supportsTools ?? false,
            supportsThinking: row.supportsThinking ?? false,
            supportsVision: row.supportsVision ?? false,
            expectedSize: row.expectedSize ?? 0,
            createdAt: row.createdAt,
            contextLength: row.contextLength ?? 0,
            taskType: row.taskType ?? null,
            license: row.license ?? null,
            label: row.label || row.name
        }))
    };
}
export function createCustomModelApi(state, { preview, deleteFiles, log }) {
    const previewSource = async (request) => {
        if (!preview) {
            throw new CoreError('CAPABILITY_UNBOUND', ['model source preview']);
        }
        return await preview(request);
    };
    return {
        customModelsWatch: watchable(() => state, () => readCustomModels(state), { name: 'customModelsWatch', log }),
        previewCustomModel: previewSource,
        addCustomModel: async (input) => {
            const checked = await previewSource({ src: input.src, mmprojSrc: input.mmprojSrc });
            if (!checked.ok) {
                throw new CoreError('CUSTOM_MODEL_SOURCE_REFUSED', [checked.reason]);
            }
            if (!checked.src) {
                throw new CoreError('CUSTOM_MODEL_AMBIGUOUS');
            }
            const unrunnable = customModelTaskRefusal(checked.taskType);
            if (unrunnable) {
                throw unrunnable;
            }
            const id = customModelId(checked.src);
            const label = input.label.trim();
            const taken = (await state.getCustomModelRows()).find((row) => (row.label || row.name) === label && row.name !== id);
            if (taken) {
                throw new CoreError('CUSTOM_MODEL_LABEL_TAKEN', [label]);
            }
            const row = {
                name: id,
                label,
                src: checked.src,
                mmprojSrc: checked.mmprojSrc ?? null,
                supportsTools: input.supportsTools ?? false,
                supportsThinking: input.supportsThinking ?? false,
                supportsVision: input.supportsVision ?? false,
                expectedSize: input.expectedSize && input.expectedSize > 0
                    ? input.expectedSize
                    : (checked.sizeBytes ?? 0),
                createdAt: Date.now(),
                contextLength: checked.contextLength ?? 0,
                taskType: checked.taskType ?? null,
                license: checked.license ?? null
            };
            await state.putCustomModelRow(row);
            return { id };
        },
        removeCustomModel: async ({ name }) => {
            const rows = await state.getCustomModelRows();
            const custom = rows.some((row) => row.name === name);
            const freed = deleteFiles && custom ? await deleteFiles({ name }) : { name, removed: 0, freedBytes: 0 };
            await state.deleteCustomModelRow(name);
            return freed;
        }
    };
}
