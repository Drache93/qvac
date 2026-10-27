import type { OCRConfig } from '../../../schemas/index.js';
/** The addon params for one OCR load, shared by the load and its fit request. */
export declare function ocrParamsFor(detectorPath: string, recognizerPath: string, ocrConfig: OCRConfig): {
    'main-gpu'?: number | "integrated" | "dedicated";
    gpuDevice?: number;
    backendDevice?: "cpu" | "vulkan" | "metal" | "opencl";
    nThreads?: number;
    recognizerBatchSize?: number;
    lowConfidenceThreshold?: number;
    contrastRetry?: boolean;
    defaultRotationAngles?: number[];
    canvasSize?: number;
    magRatio?: number;
    pipelineType?: "easyocr" | "doctr";
    langList?: string[];
    pathDetector: string;
    pathRecognizer: string;
};
