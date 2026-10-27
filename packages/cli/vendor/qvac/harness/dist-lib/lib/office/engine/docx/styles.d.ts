import type { Document, Element } from '../xml.ts';
import type { Package } from '../opc/package.ts';
export interface StyleInfo {
    el: Element;
    id: string;
    type: string;
    name: string;
    isDefault: boolean;
    basedOn: string | null;
}
export interface FormattedStyle {
    style: string;
}
export declare class Styles {
    package: Package;
    part: string | null;
    constructor(pkg: Package, part: string | null);
    get doc(): Document | null;
    all(): StyleInfo[];
    names(type?: string): string[];
    byId(id: string | null): StyleInfo | null;
    resolve(ref: unknown, type?: string): StyleInfo | null;
    require(ref: unknown, type?: string): StyleInfo;
    defaultParagraph(): StyleInfo | null;
    nameOf(styleId: string | null): string;
    headingLevel(styleId: string | null): number | null;
    numIdOf(styleId: string | null): string | null;
    isList(styleId: string | null): boolean;
    format(ref: unknown, input: unknown): FormattedStyle;
    private chain;
}
