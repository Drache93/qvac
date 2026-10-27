import type { ToolDefinition } from '../contract/index.ts';
export type ReadSkillFn = (name: string, file: string) => Promise<string> | string;
export declare function mainFileRequested(name: string, file: unknown): boolean;
export declare function skillFileArg(args: Record<string, unknown> | null | undefined): unknown;
export declare function skillFileStem(file: string): string;
export interface SkillToolOptions {
    skillsDir?: string;
    overlayDir?: string | null;
    read?: ReadSkillFn;
}
export declare function createSkillTool({ skillsDir, overlayDir, read }?: SkillToolOptions): ToolDefinition;
