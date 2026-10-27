import * as z from 'zod';
import { watchable } from './watchable.js';
const EMPTY_CAPABILITIES = {
    chat: false,
    transcription: false,
    tts: false,
    embeddings: false,
    knowledge: false
};
const EMPTY_DELEGATION = {
    enabled: false,
    targetDeviceId: null,
    targetAgentId: null,
    capabilities: EMPTY_CAPABILITIES
};
const DEFAULT_CONFIG = {
    activeAgentId: null,
    activeChatId: null,
    thinkingEnabled: true,
    ctxSize: 0,
    lastModelName: null,
    onboardingCompleted: false,
    delegation: EMPTY_DELEGATION,
    pausedModels: [],
    releasedModels: [],
    autoDownloadModels: true
};
const DelegationSchema = z.object({
    enabled: z.boolean().optional(),
    targetDeviceId: z.string().nullish(),
    targetAgentId: z.string().nullish(),
    capabilities: z
        .object({
        chat: z.boolean().optional(),
        transcription: z.boolean().optional(),
        tts: z.boolean().optional(),
        embeddings: z.boolean().optional(),
        knowledge: z.boolean().optional()
    })
        .nullish()
});
function normalizeDelegation(raw) {
    const parsed = DelegationSchema.safeParse(raw);
    if (!parsed.success) {
        return { ...EMPTY_DELEGATION, capabilities: { ...EMPTY_CAPABILITIES } };
    }
    const d = parsed.data;
    const c = d.capabilities ?? EMPTY_CAPABILITIES;
    return {
        enabled: d.enabled ?? false,
        targetDeviceId: d.targetDeviceId ?? null,
        targetAgentId: d.targetAgentId ?? null,
        capabilities: {
            chat: c.chat ?? false,
            transcription: c.transcription ?? false,
            tts: c.tts ?? false,
            embeddings: c.embeddings ?? false,
            knowledge: c.knowledge ?? false
        }
    };
}
function toConfig(row) {
    if (!row) {
        return { ...DEFAULT_CONFIG, delegation: normalizeDelegation(null) };
    }
    return {
        activeAgentId: row.activeAgentId ?? null,
        activeChatId: row.activeChatId ?? null,
        thinkingEnabled: row.thinkingEnabled ?? true,
        ctxSize: row.ctxSize ?? 0,
        lastModelName: row.lastModelName ?? null,
        onboardingCompleted: row.onboardingCompleted ?? false,
        delegation: normalizeDelegation(row.delegation),
        pausedModels: row.pausedModels ?? [],
        releasedModels: row.releasedModels ?? [],
        autoDownloadModels: !row.manualModelDownloads
    };
}
function applyWrite(current, update) {
    return {
        activeAgentId: update.activeAgentId ?? null,
        activeChatId: update.activeChatId ?? null,
        thinkingEnabled: update.thinkingEnabled ?? true,
        ctxSize: update.ctxSize ?? 0,
        lastModelName: current.lastModelName,
        onboardingCompleted: update.onboardingCompleted ?? false,
        delegation: normalizeDelegation(update.delegation),
        pausedModels: current.pausedModels,
        releasedModels: current.releasedModels,
        autoDownloadModels: current.autoDownloadModels
    };
}
function toggled(names, name, on) {
    const set = new Set(names);
    if (on) {
        set.add(name);
    }
    else {
        set.delete(name);
    }
    return [...set];
}
async function readConfig(state) {
    return toConfig(await state.getAppConfigRow());
}
function toRow(config) {
    return {
        activeAgentId: config.activeAgentId,
        activeChatId: config.activeChatId,
        thinkingEnabled: config.thinkingEnabled,
        ctxSize: config.ctxSize,
        lastModelName: config.lastModelName,
        onboardingCompleted: config.onboardingCompleted,
        delegation: config.delegation,
        pausedModels: config.pausedModels,
        releasedModels: config.releasedModels,
        manualModelDownloads: !config.autoDownloadModels
    };
}
export async function writeAutoDownloadModels(state, enabled) {
    const row = await state.updateAppConfigRow((current) => toRow({ ...toConfig(current), autoDownloadModels: enabled }));
    return toConfig(row);
}
export function createAppConfigApi(state, log) {
    return {
        getConfig(_) {
            return readConfig(state);
        },
        async setConfig(update) {
            const row = await state.updateAppConfigRow((current) => toRow(applyWrite(toConfig(current), update)));
            return toConfig(row);
        },
        async setModelPaused(input) {
            const row = await state.updateAppConfigRow((current) => {
                const config = toConfig(current);
                return toRow({
                    ...config,
                    pausedModels: toggled(config.pausedModels ?? [], input.name, input.paused ?? false)
                });
            });
            return toConfig(row);
        },
        async setModelReleased(input) {
            const row = await state.updateAppConfigRow((current) => {
                const config = toConfig(current);
                return toRow({
                    ...config,
                    releasedModels: toggled(config.releasedModels ?? [], input.name, input.released ?? false)
                });
            });
            return toConfig(row);
        },
        setAutoDownloadModels(input) {
            return writeAutoDownloadModels(state, input.enabled ?? false);
        },
        configWatchTyped: watchable(() => state, () => readConfig(state), { name: 'configWatchTyped', log })
    };
}
