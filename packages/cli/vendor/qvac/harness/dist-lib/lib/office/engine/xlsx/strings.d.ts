import type { Element } from '../xml.ts';
import type { Package } from '../opc/package.ts';
export declare function runText(container: Element): string;
export declare class SharedStrings {
    package: Package;
    workbookPart: string;
    part: string | null;
    private items;
    private index;
    constructor(pkg: Package, workbookPart: string);
    get(i: number): string | null;
    add(value: string): number;
    private ensurePart;
    private load;
}
