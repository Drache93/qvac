import type { Document, Element } from '../xml.ts';
import type { Package } from '../opc/package.ts';
import type { Change } from './formula.ts';
import type { EditState, Sheet, SheetEntry } from './sheet.ts';
export interface ReshapeHost {
    package: Package;
    main: string;
    state: EditState;
    entries(): SheetEntry[];
    definedNames(): Element[];
    chartParts(): string[];
    drawingOf(sheet: Sheet): string | null;
    sheetFor(entry: SheetEntry): Sheet;
}
export declare function formulaElements(doc: Document): Element[];
export declare function tableNames(pkg: Package, sheetPart: string): string[];
export declare function renamePivotSources(pkg: Package, from: string, to: string): void;
export declare function blockers(host: ReshapeHost, sheet: Sheet, change: Change): string[];
export declare function expandShared(sheet: Sheet): boolean;
export declare function apply(host: ReshapeHost, target: Sheet, change: Change): void;
export declare function prepare(host: ReshapeHost, target: Sheet): void;
