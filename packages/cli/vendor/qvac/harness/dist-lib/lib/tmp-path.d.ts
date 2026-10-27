export interface TmpOwner {
    uid: number;
    username: string;
}
export interface UserTmpOptions {
    readonly readOwner?: () => TmpOwner;
}
export declare function userTmpPath(name: string, opts?: UserTmpOptions): string;
