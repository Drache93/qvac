export type { CliValidator, JsonSchema, SkillCli } from './cli-schema-types.ts';
export { CLI_SCHEMA_FILENAME } from './cli-schema-types.ts';
export { argvToObject } from './cli-argv.ts';
export { loadSkillCli, resolveCliSchema, execBinFromTools } from './cli-schema-load.ts';
import type { CliValidator, SkillCli } from './cli-schema-types.ts';
export declare function buildCliValidator(def: SkillCli): CliValidator;
export declare function checkCliOps(argv: readonly string[], compiled: readonly CliValidator[]): string | null;
