import * as text from './text.ts';
import type { Document } from '../xml.ts';
import type { Package } from '../opc/package.ts';
export type ChartType = 'column' | 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
export type Legend = false | 'right' | 'left' | 'top' | 'bottom';
export type Stacking = boolean | 'percent';
export type Category = string | number;
export interface Series {
    name: string;
    values: (number | null)[];
}
export interface ChartData {
    categories: Category[];
    series: Series[];
}
export interface ChartSpec extends ChartData {
    type: ChartType;
    title?: string;
    stacked?: Stacking;
    legend?: Legend;
}
export interface ReadSeries {
    name: string | null;
    values: (string | number | null)[];
}
export interface ChartInfo {
    type: string | null;
    types?: string[];
    title: string | null;
    categories: (string | number | null)[];
    series: ReadSeries[];
}
export interface SeriesLink {
    name: string | null;
    values: string;
}
export interface ChartLinks {
    categories: string;
    series: SeriesLink[];
}
export interface WriteOptions {
    links?: ChartLinks;
}
export interface ChartRef {
    pkg: Package;
    part: string;
}
export interface DataResult {
    series: number;
    categories: number;
}
export declare const C: "http://schemas.openxmlformats.org/drawingml/2006/chart";
export declare const CHART_TYPE = "application/vnd.openxmlformats-officedocument.drawingml.chart+xml";
export declare const GRAPHIC_URI = "http://schemas.openxmlformats.org/drawingml/2006/chart";
export declare const CREATABLE: readonly ChartType[];
export declare function readChart(doc: Document): ChartInfo;
export declare function validateData(data: unknown): ChartData;
export declare function setChartData(ref: ChartRef, input: unknown, opts?: WriteOptions): DataResult;
export interface Changed {
    changed: boolean;
}
export declare function setChartTitle(ref: ChartRef, value: text.TextInput | null): Changed;
export declare function createChart(ref: ChartRef, spec: unknown, opts?: WriteOptions): string;
