import { diffusionDownloadName } from '@qvac/harness/lib/models/model-catalog.ts';
import { RUN_FAILURE_REASONS } from '../run-notices.js';
import { MODEL_TASK_TYPES } from '../../schema/engine.js';
import { toEngineSkill } from './skill-encode.js';
import { isRecord } from '../guards.js';
import { CoreError } from '../errors.js';
export function isHarnessEvent(event, type) {
    return event.type === type;
}
export function harnessListModels(harness) {
    return async ({ type, cachedOnly, fullRegistry, taskType } = {}) => {
        const rows = (await harness.list?.({
            type: type ?? undefined,
            cachedOnly: cachedOnly ?? undefined,
            fullRegistry: fullRegistry ?? undefined
        })) ?? [];
        const models = rows.map((row) => ({
            ...row,
            taskType: MODEL_TASK_TYPES.find((known) => known === row.taskType)
        }));
        return { models: taskType ? models.filter((model) => model.taskType === taskType) : models };
    };
}
export function harnessDeleteModel(harness) {
    return async ({ name }) => (await harness.deleteModel?.(name)) ?? { name, removed: 0, freedBytes: 0 };
}
export function harnessClearKvCache(harness) {
    return async () => (await harness.clearKvCache?.()) ?? {
        status: 'unsupported',
        error: 'Harness does not support KV cache deletion'
    };
}
export const PREVIEW_CONTRACT_MATCHES = true;
export const DELETE_CONTRACT_MATCHES = true;
export function harnessPreviewModelSource(harness) {
    return async ({ src, mmprojSrc }) => {
        if (!harness.previewModelSource) {
            throw new CoreError('CAPABILITY_UNSUPPORTED', ['previewModelSource']);
        }
        const preview = await harness.previewModelSource({ src, mmprojSrc: mmprojSrc ?? undefined });
        return {
            ...preview,
            files: preview.files ? [...preview.files] : undefined,
            fitReasons: preview.fitReasons ? [...preview.fitReasons] : undefined
        };
    };
}
export function harnessTranscribe(harness) {
    return async ({ audio, model }) => {
        if (!harness.transcribe) {
            throw new CoreError('CAPABILITY_UNSUPPORTED', ['transcribe']);
        }
        return { text: await harness.transcribe({ audio, model: model ?? '' }) };
    };
}
export function harnessDetectLanguage(harness) {
    return async ({ text, topK }) => {
        if (!harness.detectLanguage) {
            throw new CoreError('CAPABILITY_UNSUPPORTED', ['detectLanguage']);
        }
        const languages = await harness.detectLanguage({ text, topK: topK || undefined });
        return {
            languages: languages.map(({ code, language, probability }) => ({
                code,
                language,
                probability
            }))
        };
    };
}
export function harnessSpeak(harness) {
    return async ({ text, model }) => {
        if (!harness.speak) {
            throw new CoreError('CAPABILITY_UNSUPPORTED', ['speak']);
        }
        const { audio, sampleRate } = await harness.speak({ text, model: model ?? '' });
        return { audio, sampleRate };
    };
}
export function harnessSkillCatalog(harness, syncCredentials) {
    return async (agentId, modelName, options) => {
        if (options?.refresh) {
            await syncCredentials?.();
        }
        return {
            skills: ((await harness.skills?.(agentId, modelName, options)) ?? []).map(toEngineSkill)
        };
    };
}
export function harnessSkillManagement(harness) {
    return {
        async listManagedSkills() {
            return {
                skills: ((await harness.listManagedSkills?.()) ?? []).map((skill) => ({
                    name: skill.name,
                    origin: skill.origin,
                    overridesBase: skill.overridesBase
                }))
            };
        },
        async readSkillFile(name) {
            const file = await harness.readSkillFile?.(name);
            return file ? { found: true, content: file.content, origin: file.origin } : { found: false };
        },
        async writeSkillFile(name, content) {
            if (!harness.writeSkillFile) {
                return { ok: false };
            }
            return harness.writeSkillFile(name, content);
        },
        async copySkillForEdit(name) {
            return { copied: (await harness.copyBaseForEdit?.(name))?.copied ?? false };
        },
        async deleteOverlaySkill(name) {
            return { removed: (await harness.deleteOverlaySkill?.(name))?.removed ?? false };
        }
    };
}
export function harnessTools(harness) {
    return async () => ({
        tools: ((await harness.tools?.()) ?? []).map((tool) => ({
            ...toolReportEntry(tool),
            description: tool.description
        }))
    });
}
export function toolReportEntry(tool) {
    return {
        name: tool.name,
        promptChars: tool.promptChars ?? 0,
        toolset: tool.toolset ?? null,
        skillGated: tool.skillGated === true,
        scopeRequired: tool.scopeRequired === true,
        rootsRequired: tool.rootsRequired === true,
        writeRootsRequired: tool.writeRootsRequired === true
    };
}
export function harnessSpeakStream(harness) {
    return async function* (text) {
        if (!harness.speakStream) {
            throw new CoreError('CAPABILITY_UNSUPPORTED', ['speakStream']);
        }
        for await (const { audio, sampleRate } of harness.speakStream({ model: '', text })) {
            yield { audio, sampleRate };
        }
    };
}
export function harnessDeathReason(status) {
    const HARNESS_DIED = RUN_FAILURE_REASONS.harnessDied;
    if (typeof status !== 'object' || status === null) {
        return HARNESS_DIED;
    }
    const detail = 'error' in status && typeof status.error === 'string' && status.error ? status.error : null;
    const code = 'code' in status && typeof status.code === 'string' && status.code ? status.code : null;
    if (!detail) {
        return code ? `${HARNESS_DIED} (${code})` : HARNESS_DIED;
    }
    return code ? `${HARNESS_DIED}: ${detail} (${code})` : `${HARNESS_DIED}: ${detail}`;
}
export function harnessDied(status) {
    if (typeof status !== 'object' || status === null || !('state' in status)) {
        return false;
    }
    return status.state === 'died';
}
export function modelCatalogChanged(state) {
    return isRecord(state) && state.catalogChanged === true;
}
export function heldLoadModel(state) {
    if (typeof state !== 'object' ||
        state === null ||
        !('status' in state) ||
        state.status !== 'held' ||
        !('model' in state) ||
        typeof state.model !== 'string') {
        return null;
    }
    return state.model;
}
export function droppedHeldLoadModel(state) {
    if (typeof state !== 'object' ||
        state === null ||
        !('status' in state) ||
        state.status !== 'error' ||
        !('message' in state) ||
        state.message !== 'aborted' ||
        !('addon' in state) ||
        typeof state.addon !== 'string' ||
        !('model' in state) ||
        typeof state.model !== 'string') {
        return null;
    }
    return state.model;
}
export function imageDownloadProgress(state) {
    if (typeof state !== 'object' ||
        state === null ||
        !('status' in state) ||
        (state.status !== 'downloading' && state.status !== 'downloaded') ||
        !('model' in state) ||
        typeof state.model !== 'string' ||
        !('percentage' in state) ||
        typeof state.percentage !== 'number' ||
        !Number.isFinite(state.percentage) ||
        !('downloaded' in state) ||
        typeof state.downloaded !== 'number' ||
        !Number.isFinite(state.downloaded) ||
        !('total' in state) ||
        typeof state.total !== 'number' ||
        !Number.isFinite(state.total)) {
        return null;
    }
    const model = diffusionDownloadName(state.model);
    if (!model) {
        return null;
    }
    return {
        model,
        phase: state.status === 'downloading' ? 'downloading' : 'complete',
        percentage: state.percentage,
        downloaded: state.downloaded,
        total: state.total
    };
}
