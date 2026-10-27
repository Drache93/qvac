import TranslationNmtcpp from '@qvac/translation-nmtcpp';
import { definePlugin, defineHandler, translateRequestSchema, translateResponseSchema, ModelType, nmtConfigBaseSchema, ADDON_NMT } from '../../../schemas/index.js';
import { createStreamLogger, registerAddonLogger } from '../../../logging/index.js';
import { translate } from '../../ops/translate.js';
import { attachModelExecutionMs } from '../../../profiling/model-execution.js';
import { nmtConfigFor, nmtFilesFor } from './load-files.js';
import { resolveBergamotVocab } from './resolve-vocab.js';
function createNmtModel(modelId, files, nmtConfig) {
    const logger = createStreamLogger(modelId, ModelType.nmtcppTranslation);
    registerAddonLogger(modelId, ModelType.nmtcppTranslation, logger);
    const model = new TranslationNmtcpp({
        files,
        params: { srcLang: nmtConfig.from, dstLang: nmtConfig.to },
        config: nmtConfigFor(nmtConfig, files.pivotModel),
        logger,
        opts: { stats: true }
    });
    return { model };
}
export const nmtPlugin = definePlugin({
    modelType: ModelType.nmtcppTranslation,
    displayName: 'NMT (nmtcpp)',
    addonPackage: ADDON_NMT,
    loadConfigSchema: nmtConfigBaseSchema,
    assessFit: TranslationNmtcpp.assessFit,
    async resolveConfig(cfg, ctx) {
        const { srcVocabSrc, dstVocabSrc, pivotModel, ...nmtConfig } = cfg;
        if (nmtConfig.engine !== 'Bergamot') {
            return { config: nmtConfig };
        }
        const bergamotConfig = { ...nmtConfig, ...(pivotModel && { pivotModel }) };
        return resolveBergamotVocab(bergamotConfig, ctx, srcVocabSrc, dstVocabSrc, pivotModel);
    },
    createModel(params) {
        const nmtConfig = (params.modelConfig ?? {});
        const files = nmtFilesFor(params.modelPath, params.artifacts ?? {});
        const { model } = createNmtModel(params.modelId, files, nmtConfig);
        return { model };
    },
    handlers: {
        translate: defineHandler({
            requestSchema: translateRequestSchema,
            responseSchema: translateResponseSchema,
            streaming: true,
            // nmtcpp 0.7.0 exposes response.cancel(), but the translate op is not
            // wired for addon-level cancellation yet — we keep soft-cancel (stop
            // yielding, drop result, skip post-processing; the C++ work may run to
            // completion).
            cancel: { scope: 'none' },
            handler: async function* (request) {
                const stream = translate(request, request.requestId);
                try {
                    let result = await stream.next();
                    while (!result.done) {
                        yield {
                            type: 'translate',
                            token: result.value
                        };
                        result = await stream.next();
                    }
                    const { modelExecutionMs, stats } = result.value;
                    yield attachModelExecutionMs({
                        type: 'translate',
                        token: '',
                        done: true,
                        ...(stats && { stats })
                    }, modelExecutionMs);
                }
                finally {
                    await stream.return?.(undefined);
                }
            }
        })
    },
    logging: {
        module: () => import('@qvac/translation-nmtcpp/addonLogging'),
        namespace: ModelType.nmtcppTranslation
    }
});
