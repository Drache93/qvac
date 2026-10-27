export interface VersionFloor {
    readonly range: string | null | undefined;
    readonly appVersion: string | null | undefined;
}
export declare function releaseVersion(version: string): string;
export declare function updateRequired({ range, appVersion }: VersionFloor): boolean;
