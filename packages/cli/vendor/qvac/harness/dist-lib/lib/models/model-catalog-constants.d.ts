export type CapabilityProfile = 'tiny' | 'low' | 'mid' | 'high' | 'xhigh';
export declare const CAPABILITY_PROFILE_ORDER: readonly CapabilityProfile[];
export declare const QWEN_35_2B = "Qwen3.5-2B-Q4_K_M";
export declare const QWEN_35_4B = "Qwen3.5-4B-Q4_K_M";
export declare const QWEN_35_9B = "Qwen3.5-9B-Q4_K_M";
export declare const QWEN_36_27B = "Qwen3.6-27B-UD-Q4_K_XL";
export declare const QWEN_36_35B_A3B = "Qwen3.6-35B-A3B-UD-Q4_K_M";
export declare const QWEN_38_27B = "Qwen3.8-27B-UD-Q4_K_XL";
export declare const BONSAI_2_27B_PQ2 = "Ternary-Bonsai-2-27B-PQ2_0";
export declare const BONSAI_2_27B_PTQ1 = "Ternary-Bonsai-2-27B-PTQ1_0";
export declare const MEDPSY_1_7B = "medpsy-1.7b-q4_k_m-imat";
export declare const MEDPSY_4B = "medpsy-4b-q4_k_m-imat";
export declare function isCapabilityProfile(value: string): value is CapabilityProfile;
export declare function meetsMinCapabilityProfile(active: CapabilityProfile, required: CapabilityProfile): boolean;
export declare function modelNameToCapabilityProfile(modelName: string): CapabilityProfile | undefined;
export interface HostCapability {
    readonly capabilityProfile: string;
    readonly recommendedModelName: string;
    readonly mobile: boolean;
}
export declare function isMobilePlatform(platform: string): boolean;
export declare function runnableModelName(requested: string, host: HostCapability | null): string;
export declare function capabilityProfileToModelName(profile: CapabilityProfile): string;
export declare const AGENT_MODEL_NAMES: readonly ["Qwen3.5-2B-Q4_K_M", "Qwen3.5-4B-Q4_K_M", "Qwen3.5-9B-Q4_K_M", "Qwen3.6-27B-UD-Q4_K_XL", "Qwen3.6-35B-A3B-UD-Q4_K_M", "Qwen3.8-27B-UD-Q4_K_XL", "Ternary-Bonsai-2-27B-PQ2_0", "Ternary-Bonsai-2-27B-PTQ1_0", "medpsy-1.7b-q4_k_m-imat", "medpsy-4b-q4_k_m-imat"];
export declare function modelDisplayName(modelName: string): string;
export declare function capabilityProfileModelLabel(profile: CapabilityProfile): string;
export declare function isMultimodalLlm(modelName: string): boolean;
export type ImageModelChoice = 'sd2' | 'sdxl' | 'flux2-klein';
export declare const DEFAULT_IMAGE_MODEL_CHOICE: ImageModelChoice;
export interface ImageChoiceEntry {
    readonly choice: ImageModelChoice;
    readonly label: string;
    readonly requiresGpu: boolean;
    readonly supportsMultiImageEdit: boolean;
    readonly sizeBytesApprox: number;
    readonly notes: string;
}
export declare const IMAGE_CHOICE_CATALOG: ReadonlyArray<ImageChoiceEntry>;
