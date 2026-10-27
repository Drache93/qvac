export type FsGrant = {
    readonly kind: 'local';
    readonly path: string;
} | HyperGrant;
export interface HyperGrant {
    readonly kind: 'hyper';
    readonly key: string;
}
export declare function fsGrantsFrom(value: unknown): FsGrant[];
export declare function grantedDirsFrom(value: unknown): string[];
