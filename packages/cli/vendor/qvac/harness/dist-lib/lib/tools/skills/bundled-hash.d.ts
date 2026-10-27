export interface BundledFile {
    path: string;
    content: string;
}
export declare function hashBundledSkills(files: ReadonlyArray<BundledFile>): string;
