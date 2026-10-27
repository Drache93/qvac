import type { Box } from './inherit.ts';
import type { SlideSize } from './template.ts';
export type Role = 'slot' | 'blank' | 'body' | 'picture' | 'other';
export interface Size {
    readonly width: number;
    readonly height: number;
}
export interface Placed {
    readonly box: Box;
    readonly role: Role;
}
export interface Beside<T> {
    readonly shape: T;
    readonly box: Box;
}
export interface Area<T> {
    readonly box: Box;
    readonly cleared: readonly T[];
    readonly beside: Beside<T> | null;
}
export declare function framed(slide: SlideSize): Box;
export declare function fitted(size: Size, area: Box): Box;
export declare function pictureArea<T extends Placed>(slide: SlideSize, shapes: readonly T[]): Area<T>;
