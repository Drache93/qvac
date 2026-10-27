import { HarnessError } from './errors.js';
import stowChild, {} from 'bare-supervisor/stow';
import { connectHarness } from './connect.js';
import { HarnessLog } from './log.js';
import { createEmbedConfig } from './models/embed-config.js';
export function harnessChild(entry, opts) {
    if (opts.logger) {
        HarnessLog.toHost(opts.logger);
    }
    const { runner, skillsDir, gpuStats, wheelsDir, sdkStorage, embedDevice, embedGpuLayers, embedBatchSize, imageModel, imageClamps, musicModel, musicClamps, llm, knowledge, pluginOptions, onIpc, logger = null, ...spec } = opts;
    const embedConfig = createEmbedConfig({
        device: embedDevice,
        gpuLayers: embedGpuLayers,
        batchSize: embedBatchSize
    });
    return stowChild(entry, {
        ...spec,
        runner,
        args: [
            skillsDir ?? '',
            sdkStorage ? JSON.stringify(sdkStorage) : '',
            JSON.stringify(embedConfig),
            imageModel ? JSON.stringify(imageModel) : '',
            imageClamps ? JSON.stringify(imageClamps) : '',
            logSlot(logger),
            llm ? JSON.stringify(llm) : '',
            musicModel ? JSON.stringify(musicModel) : '',
            musicClamps ? JSON.stringify(musicClamps) : '',
            wheelsDir ?? '',
            gpuStats === undefined ? '' : JSON.stringify(gpuStats),
            knowledge ? JSON.stringify(knowledge) : '',
            pluginOptions ? JSON.stringify(pluginOptions) : ''
        ],
        logger,
        create: (ipc) => {
            onIpc?.(ipc);
            return connectHarness(() => ipc);
        }
    });
}
export function spawnHarness(opts) {
    const logger = opts.logger ?? null;
    if (logger) {
        HarnessLog.toHost(logger);
    }
    const embedConfig = createEmbedConfig({
        device: opts.embedDevice,
        gpuLayers: opts.embedGpuLayers,
        batchSize: opts.embedBatchSize
    });
    return connectHarness(async () => {
        const { default: launch } = await import('bare-supervisor/runner/sidecar');
        const { ipc, exit } = launch(opts.entry, [
            opts.skillsDir ?? '',
            JSON.stringify(opts.sdkStorage),
            JSON.stringify(embedConfig),
            opts.imageModel ? JSON.stringify(opts.imageModel) : '',
            opts.imageClamps ? JSON.stringify(opts.imageClamps) : '',
            logSlot(logger),
            opts.llm ? JSON.stringify(opts.llm) : '',
            opts.musicModel ? JSON.stringify(opts.musicModel) : '',
            opts.musicClamps ? JSON.stringify(opts.musicClamps) : '',
            opts.wheelsDir ?? '',
            opts.gpuStats === undefined ? '' : JSON.stringify(opts.gpuStats),
            opts.knowledge ? JSON.stringify(opts.knowledge) : '',
            opts.pluginOptions ? JSON.stringify(opts.pluginOptions) : ''
        ], logger);
        const died = exit.then((code) => new HarnessError('HARNESS_EXITED_BEFORE_READY', [code]));
        const failure = await Promise.race([ipc.ready.then(() => null), died]);
        if (failure) {
            throw failure;
        }
        return ipc;
    });
}
function logSlot(logger) {
    if (!logger)
        return '';
    const level = logger.getLevel?.();
    return HarnessLog.isLevel(level) ? level : '1';
}
