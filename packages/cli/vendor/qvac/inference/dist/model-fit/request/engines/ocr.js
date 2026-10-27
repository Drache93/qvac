import { ocrParamsFor } from '../../../plugins/builtin/ggml-ocr/params.js';
export function createOcrFitRequest(params) {
    const detectorPath = params.artifacts?.['detectorModelPath'];
    if (detectorPath === undefined) {
        return { supported: false, detail: 'the ocr detector is not resolved' };
    }
    const config = (params.modelConfig ?? {});
    const request = {
        ...ocrParamsFor(detectorPath, params.modelPath, config),
        ...(params.marginBytes !== undefined && { marginBytes: params.marginBytes })
    };
    return { supported: true, probe: { engine: 'ocr-ggml', request } };
}
