import type { HarnessPlugin, PluginContext, PluginSetup } from '../../lib/plugins/index.ts';
import { type TranslationPlan, type TranslationRefusal } from './nmt-catalog.ts';
export type { TranslationPlan, TranslationRefusal } from './nmt-catalog.ts';
export declare class TranslationPlugin implements HarnessPlugin {
    static readonly NMT_TO_ENGLISH: readonly string[];
    static readonly NMT_FROM_ENGLISH: readonly string[];
    static readonly EURONANO_LANGUAGES: readonly string[];
    static readonly SLM_LANGUAGE_CODES: readonly string[];
    static readonly SLM_LANGUAGE_NAMES: readonly {
        code: string;
        name: string;
    }[];
    static planFor(from: string, to: string): TranslationPlan | TranslationRefusal;
    readonly name = "translation";
    readonly api = 1;
    readonly provides: string[];
    readonly needs: string[];
    readonly addons: {
        translation: () => Promise<typeof import("@qvac/inference/nmtcpp-translation/plugin")>;
        'translation-nmtcpp': () => Promise<typeof import("@qvac/translation-nmtcpp/addonLogging")>;
    };
    setup(ctx: PluginContext): PluginSetup;
}
