import type { MemoryBudget } from './memory-budget.ts';
export declare const IGPU_LIE_THRESHOLD = 0.9;
export declare function parseNvidiaSmiOutput(stdout: string): MemoryBudget | null;
export declare function parseRocmSmiOutput(stdout: string): MemoryBudget | null;
export declare function parseWindowsRegistryOutput(stdout: string, systemRamBytes: number): MemoryBudget | null;
export declare function sharedRamBudget(ramBytes: number): MemoryBudget;
export declare function mobileBudget(ramBytes: number, isPixel: boolean): MemoryBudget;
