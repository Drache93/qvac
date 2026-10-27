export declare const MUSIC_MODEL_CHOICES: readonly ['turbo', 'turbo-hq', 'sft', 'base'];
export type MusicModelChoice = (typeof MUSIC_MODEL_CHOICES)[number];
export declare const GENERATE_MUSIC_TOOL = "generate_music";
export declare const DEFAULT_MUSIC_MODEL_CHOICE: MusicModelChoice;
export interface MusicChoiceEntry {
    readonly choice: MusicModelChoice;
    readonly label: string;
    readonly sizeBytesApprox: number;
    readonly requiresGpu: boolean;
    readonly notes: string;
}
export declare const MUSIC_CHOICE_CATALOG: ReadonlyArray<MusicChoiceEntry>;
export declare function musicModelChoiceFrom(settings: unknown): MusicModelChoice | undefined;
export declare function isMusicModelChoice(value: unknown): value is MusicModelChoice;
