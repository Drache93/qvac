import type { SkillRequires } from './manifest.ts';
export type BinVersionState = 'ok' | 'too-old' | 'unknown';
export declare function binOnPath(bin: string, platform?: string): boolean;
export declare function missingBins(bins: readonly string[], platform?: string, probe?: (bin: string, platform?: string) => boolean): string[];
export interface ProbeBinVersionsOptions {
    platform?: string;
    run: (command: string) => Promise<string | null>;
    binPresent?: (bin: string) => boolean | Promise<boolean>;
}
export declare function probeBinVersions(requires: SkillRequires | undefined, opts: ProbeBinVersionsOptions): Promise<Map<string, BinVersionState>>;
