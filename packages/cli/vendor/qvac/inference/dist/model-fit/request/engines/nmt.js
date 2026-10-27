import { nmtConfigFor, nmtFilesFor } from '../../../plugins/builtin/nmtcpp-translation/load-files.js';
export function createNmtFitRequest(params) {
    const config = (params.modelConfig ?? {});
    const files = nmtFilesFor(params.modelPath, params.artifacts ?? {});
    const request = {
        files,
        config: nmtConfigFor(config, files.pivotModel),
        ...(params.marginBytes !== undefined && { marginBytes: params.marginBytes })
    };
    return { supported: true, probe: { engine: 'translation-nmtcpp', request } };
}
