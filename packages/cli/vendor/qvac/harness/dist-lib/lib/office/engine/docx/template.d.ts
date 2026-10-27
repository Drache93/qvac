import type { Package } from '../opc/package.ts';
export interface Fonts {
    heading: string;
    body: string;
}
export interface CreateOptions {
    title?: string;
    page?: 'letter' | 'a4';
    size?: number;
    fonts?: Partial<Fonts>;
}
interface Page {
    width: number;
    height: number;
}
export declare const PAGES: Record<string, Page>;
export declare function build(pkg: Package, input?: unknown): void;
export {};
