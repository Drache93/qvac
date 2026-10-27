import type { Tool as SdkTool } from '@qvac/inference';
export interface PromptPrefix {
    system: string | null;
    tools: ReadonlyArray<SdkTool> | undefined;
}
export declare function promptPrefixHash({ system, tools }: PromptPrefix): string;
