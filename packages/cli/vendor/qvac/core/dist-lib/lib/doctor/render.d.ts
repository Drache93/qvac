import type { Check, CheckState } from './checks.ts';
export type PaintKind = CheckState | 'title' | 'explain';
export type Paint = (text: string, kind: PaintKind) => string;
export interface RenderOptions {
    paint?: Paint | undefined;
}
export declare function summarize(checks: ReadonlyArray<Check>): string;
export declare function checkLines(checks: ReadonlyArray<Check>, { paint }?: RenderOptions): string[];
