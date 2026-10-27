import type { TranslationNmtcppConfig, TranslationNmtcppFiles } from '@qvac/translation-nmtcpp';
import { type NmtConfig } from '../../../schemas/index.js';
/** The files one translation load opens, shared by the load and its fit request. */
export declare function nmtFilesFor(modelPath: string, artifacts: Record<string, string>): TranslationNmtcppFiles;
/** The addon config for one translation load, shared with its fit request. */
export declare function nmtConfigFor(nmtConfig: NmtConfig, pivotModelPath?: string): TranslationNmtcppConfig;
