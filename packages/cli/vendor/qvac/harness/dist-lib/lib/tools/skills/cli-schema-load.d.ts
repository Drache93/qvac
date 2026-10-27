import { type SkillCli } from './cli-schema-types.ts';
export declare function resolveCliSchema(skillDir: string, bin: string, readFile?: (p: string) => Promise<string>): Promise<SkillCli>;
export declare function execBinFromTools(tools: readonly string[]): string | undefined;
export declare function loadSkillCli(skillDir: string, tools: readonly string[], readFile?: (p: string) => Promise<string>): Promise<SkillCli | undefined>;
