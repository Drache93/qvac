import type { Chart } from './layout.ts';
import type { ReportModel } from './model.ts';
import type { ReportParts } from './index.ts';
import type { Flow } from './flow.ts';
export declare const FONTS = "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Inconsolata:wght@400;600;700&display=swap";
export interface Charts {
    run: Chart;
    all: Chart;
}
export interface Views {
    flow: Flow;
    machine: Charts | null;
}
export interface ShellOptions {
    live?: {
        source: string;
    };
}
export declare function parts(model: ReportModel, views: Views, title: string): ReportParts;
export declare function page(model: ReportModel, views: Views, title: string): string;
export declare function shell(report: ReportParts | null, { live }?: ShellOptions): string;
export declare function esc(value: string): string;
