export declare const RELEASE_LANES: readonly ['dev', 'staging', 'prod'];
export type ReleaseLane = (typeof RELEASE_LANES)[number];
export interface AppBuildMetadata {
    readonly version: string;
    readonly build?: string;
    readonly channel: ReleaseLane;
}
