export interface ManagedSkill {
    readonly name: string;
    readonly origin: 'base' | 'overlay';
    readonly overridesBase: boolean;
}
export interface SkillFileContent {
    readonly content: string;
    readonly origin: 'base' | 'overlay';
}
export declare function listManagedSkills(baseDir: string, overlayDir: string | null): Promise<ManagedSkill[]>;
export declare function readSkillFile(baseDir: string, overlayDir: string | null, name: string): Promise<SkillFileContent | null>;
export declare function writeSkillFile(overlayDir: string, name: string, content: string): Promise<string>;
export interface CopyBaseResult {
    copied: boolean;
}
export declare function copyBaseForEdit(baseDir: string, overlayDir: string, name: string): Promise<CopyBaseResult>;
export interface DeleteOverlayResult {
    removed: boolean;
}
export declare function deleteOverlaySkill(overlayDir: string, name: string): Promise<DeleteOverlayResult>;
