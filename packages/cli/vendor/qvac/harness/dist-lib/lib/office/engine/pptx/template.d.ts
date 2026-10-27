import type { Package } from '../opc/package.ts';
export interface SlideSize {
    width: number;
    height: number;
}
export type ThemeColor = 'dark1' | 'light1' | 'dark2' | 'light2' | 'accent1' | 'accent2' | 'accent3' | 'accent4' | 'accent5' | 'accent6' | 'hyperlink' | 'followedHyperlink';
export interface ThemeFonts {
    heading: string;
    body: string;
}
export interface CreateOptions {
    size?: '16:9' | '4:3' | SlideSize;
    title?: string;
    fonts?: Partial<ThemeFonts>;
    colors?: Partial<Record<ThemeColor, string>>;
}
export declare const SIZES: Record<'16:9' | '4:3', SlideSize>;
export declare const TABLE_STYLE = "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}";
export declare function build(pkg: Package, opts?: unknown): void;
export declare function notesTheme(): Uint8Array;
