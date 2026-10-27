import type { Package } from '../opc/package.ts';
export interface CreateOptions {
    sheets?: string[];
    title?: string;
    strict?: boolean;
}
export declare function build(pkg: Package, opts?: CreateOptions): void;
