import type { Box, Insets } from './inherit.ts';
export interface SizedParagraph {
    text: string;
    level: number;
    size: number;
}
export interface Estimate {
    overflow: boolean;
    fontScale: number;
    lineReduction: number;
}
export declare function estimate(paragraphs: SizedParagraph[], box: Box, insets: Insets): Estimate;
