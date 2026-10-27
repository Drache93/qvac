import { Version } from 'bare-semver';
export declare function currentReleaseVersion(root: string): Version;
export interface PreviousReleaseTagsOptions {
    count?: number;
    carries: string;
}
export declare function previousReleaseTags(root: string, { count, carries }: PreviousReleaseTagsOptions): string[];
