import type { Package } from './package.ts';
export interface SaveOptions {
    modified?: Date;
    modifiedBy?: string;
}
export declare function applySaveOptions(pkg: Package, opts?: SaveOptions): void;
export declare function refreshSummary(pkg: Package, counts?: Record<string, number>): void;
