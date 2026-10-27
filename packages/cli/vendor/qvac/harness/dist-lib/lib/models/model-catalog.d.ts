import type { ModelRegistryEntry, ToolDialect } from '@qvac/inference';
import type { ModelSrc } from './context.ts';
import type { ModelAddon } from './model-source.ts';
export interface SdkModelAsset extends ModelRegistryEntry {
    readonly src: string;
}
import { CAPABILITY_PROFILE_ORDER, QWEN_35_2B, QWEN_35_4B, QWEN_35_9B, QWEN_36_27B, QWEN_36_35B_A3B, QWEN_38_27B, BONSAI_2_27B_PQ2, BONSAI_2_27B_PTQ1, MEDPSY_1_7B, MEDPSY_4B, isCapabilityProfile, meetsMinCapabilityProfile, modelNameToCapabilityProfile, capabilityProfileToModelName, isMultimodalLlm, AGENT_MODEL_NAMES, modelDisplayName, capabilityProfileModelLabel, DEFAULT_IMAGE_MODEL_CHOICE, IMAGE_CHOICE_CATALOG, isMobilePlatform, runnableModelName, type CapabilityProfile, type HostCapability, type ImageModelChoice, type ImageChoiceEntry } from './model-catalog-constants.ts';
export { CAPABILITY_PROFILE_ORDER, QWEN_35_2B, QWEN_35_4B, QWEN_35_9B, QWEN_36_27B, QWEN_36_35B_A3B, QWEN_38_27B, BONSAI_2_27B_PQ2, BONSAI_2_27B_PTQ1, MEDPSY_1_7B, MEDPSY_4B, isCapabilityProfile, meetsMinCapabilityProfile, modelNameToCapabilityProfile, capabilityProfileToModelName, isMultimodalLlm, AGENT_MODEL_NAMES, modelDisplayName, capabilityProfileModelLabel, DEFAULT_IMAGE_MODEL_CHOICE, IMAGE_CHOICE_CATALOG, isMobilePlatform, runnableModelName };
export type { CapabilityProfile, HostCapability, ImageModelChoice, ImageChoiceEntry };
export interface LlmCatalogEntry {
    readonly name: string;
    readonly weight: SdkModelAsset;
    readonly capabilityProfile: CapabilityProfile;
    readonly projection?: SdkModelAsset;
    readonly textOnly?: true;
    readonly toolDialect?: ToolDialect;
}
export declare const LLM_CATALOG: ReadonlyArray<LlmCatalogEntry>;
export declare function defaultProjectionMap(): Record<string, string>;
export type ModelCategory = 'tts' | 'transcription' | 'embedding';
export interface CategoryDefault {
    readonly name: string;
    readonly category: ModelCategory;
    readonly asset: SdkModelAsset;
    readonly modelConfig?: Readonly<Record<string, unknown>>;
    readonly companions?: ReadonlyArray<SdkModelAsset>;
}
export declare const MOSS_TTS: CategoryDefault;
export declare const MOSS_CODEC_ENCODER_SRC: "registry://s3/qvac_models_compiled/ggml/openmoss/2026-09-25/moss-codec-encoder-f16.gguf";
export declare const CATEGORY_DEFAULTS: ReadonlyArray<CategoryDefault>;
export declare function categoryModelConfig(modelSrc: ModelSrc): Readonly<Record<string, unknown>> | undefined;
export interface CategoryDownloadMetadata {
    readonly companions: ReadonlyArray<string>;
    readonly assetSizes: Readonly<Record<string, number>>;
}
export declare function categoryDownloadMetadata(model: string, addon: ModelAddon | undefined): CategoryDownloadMetadata | undefined;
export declare function defaultVoiceModel(category: ModelCategory): string;
export declare function defaultTtsFor(profile: CapabilityProfile): CategoryDefault;
export interface CatalogModel {
    readonly name: string;
    readonly addon: ModelAddon;
}
export declare function infraModelsFor(profile: CapabilityProfile): CatalogModel[];
export declare function mediaModelNameFor(category: ModelCategory, profile: CapabilityProfile): string;
export interface DiffusionCatalogEntry {
    readonly choice: ImageModelChoice;
    readonly name: string;
    readonly model: SdkModelAsset;
    readonly llmModel?: SdkModelAsset;
    readonly vaeModel?: SdkModelAsset;
    readonly prediction?: 'flux2_flow';
    readonly requiresGpu: boolean;
    readonly supportsImg2Img: boolean;
}
export declare const DIFFUSION_CATALOG: ReadonlyArray<DiffusionCatalogEntry>;
export interface DiffusionDownloadMetadata {
    readonly companions: ReadonlyArray<string>;
    readonly assetSizes: Readonly<Record<string, number>>;
}
export declare function diffusionDownloadName(model: string): string | null;
export declare function diffusionDownloadMetadata(model: string, addon: ModelAddon | undefined): DiffusionDownloadMetadata | undefined;
export declare function assetBytes(src: string): number | undefined;
import { DEFAULT_MUSIC_MODEL_CHOICE, isMusicModelChoice, musicModelChoiceFrom, type MusicModelChoice } from './music-catalog.ts';
export { DEFAULT_MUSIC_MODEL_CHOICE, isMusicModelChoice, musicModelChoiceFrom, type MusicModelChoice };
export interface AudioGenCatalogEntry {
    readonly choice: MusicModelChoice;
    readonly name: string;
    readonly dit: SdkModelAsset;
    readonly textEnc: SdkModelAsset;
    readonly lm: SdkModelAsset;
    readonly vae: SdkModelAsset;
    readonly requiresGpu: boolean;
    readonly defaultSteps: number;
}
export declare const AUDIOGEN_CATALOG: ReadonlyArray<AudioGenCatalogEntry>;
export declare function musicDefaultSteps(choice: string | undefined): number | undefined;
export declare function musicChoiceForDit(dit: string): MusicModelChoice | undefined;
export declare function musicSizeBytes(entry: AudioGenCatalogEntry): number;
export declare function musicModelSet(choice: string | undefined): MusicModelStages | null;
export interface AudioGenDownloadMetadata {
    readonly companions: ReadonlyArray<string>;
    readonly assetSizes: Readonly<Record<string, number>>;
}
export declare function audioGenDownloadMetadata(model: string, addon: ModelAddon | undefined): AudioGenDownloadMetadata | undefined;
export interface AgentSkillModelInput {
    readonly enabledSkills?: ReadonlyArray<string> | null;
    readonly installedSkills?: ReadonlyArray<string> | null;
    readonly skillsScope?: 'all' | 'selected' | null;
    readonly imageModelChoice?: ImageModelChoice | null;
    readonly musicModelChoice?: MusicModelChoice | null;
}
export type AgentModelUse = 'chat' | 'image' | 'music';
export interface AgentModel extends CatalogModel {
    readonly use: AgentModelUse;
}
export interface AgentModelInput extends AgentSkillModelInput {
    readonly modelName?: string | null;
}
export declare function skillModelsForAgent(agent: AgentSkillModelInput): ReadonlyArray<AgentModel>;
export declare function modelsForAgent(agent: AgentModelInput, host: HostCapability | null): ReadonlyArray<AgentModel>;
export declare function diffusionSizeBytes(entry: DiffusionCatalogEntry): number;
export declare function imageModelFor(choice: string | undefined): ImageModelSet | null;
export interface ImageClamps {
    maxDim?: number;
    maxSteps?: number;
}
export interface ImageModelSet {
    model: string;
    llmModel?: string;
    vaeModel?: string;
    prediction?: 'flux2_flow';
}
export interface MusicModelStages {
    dit: string;
    textEnc: string;
    lm: string;
    vae: string;
}
export interface MusicClamps {
    maxDuration?: number;
    maxSteps?: number;
}
export declare function imageClampsFromEnv(env: Record<string, string | undefined>): ImageClamps | undefined;
export declare function imageModelFromEnv(env: Record<string, string | undefined>, onIgnoredCompanions?: () => void, onIgnoredPrediction?: () => void): NonNullable<ReturnType<typeof imageModelFor>> | undefined;
export interface CuratedListable {
    readonly name: string;
    readonly asset: SdkModelAsset;
    readonly companions: SdkModelAsset[];
    readonly projection?: SdkModelAsset;
}
export declare function curatedListables(): CuratedListable[];
export declare function curatedModelAsset(name: string, addon: ModelRegistryEntry['addon']): SdkModelAsset | undefined;
export declare function modelAddonOf(model: string): ModelRegistryEntry['addon'];
export declare function residentSrc(model: string, addon: ModelRegistryEntry['addon']): string;
export declare function catalogModelName(model: string, addon: ModelRegistryEntry['addon']): string;
export declare const CUSTOM_TASK_TYPES: readonly ['llm'];
export type CustomTaskType = (typeof CUSTOM_TASK_TYPES)[number];
export interface CustomModelEntry {
    readonly name: string;
    readonly src: string;
    readonly projectionSrc?: string;
    readonly taskType?: CustomTaskType;
    readonly expectedSize?: number;
    readonly label?: string;
    readonly contextLength?: number;
}
export declare function setCustomModels(entries: ReadonlyArray<CustomModelEntry>): void;
export declare function customModels(): ReadonlyArray<CustomModelEntry>;
export declare function customContextLength(name: string): number | undefined;
export declare function customModelSrc(name: string, addon: ModelRegistryEntry['addon']): string | undefined;
export declare function toolDialectFor(name: string): ToolDialect | undefined;
export declare function customToolDialect(name: string): ToolDialect | undefined;
export declare function customProjectionMap(): Record<string, string>;
export declare function companionRegistryPaths(): Map<string, string[]>;
export declare function audioGenModelByName(name: string): SdkModelAsset | undefined;
export interface MusicListable {
    readonly name: string;
    readonly asset: SdkModelAsset;
    readonly companions: ReadonlyArray<SdkModelAsset>;
    readonly expectedSize: number;
}
export declare function musicListables(): MusicListable[];
