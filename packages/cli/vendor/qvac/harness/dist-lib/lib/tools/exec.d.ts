import type { ToolDefinition } from '../contract/index.ts';
import type { ExecLanguage, ExecRoute, ExecShell } from '../contract/exec.ts';
import { type KillProcess, type SpawnFn } from './exec/runner.ts';
import { type Realpath } from './fs/scope.ts';
import { type SkillSettingsFn } from './skills/skill-settings.ts';
export type { ExecLanguage, ExecRoute, ExecShell } from '../contract/exec.ts';
export type { ExecResult, KillProcess, SpawnFn } from './exec/runner.ts';
export interface ExecToolOptions {
    readonly policyVersion?: string;
    readonly spawn?: SpawnFn;
    readonly killProcess?: KillProcess;
    readonly shell?: ExecShell;
    readonly languages?: readonly ExecLanguage[];
    readonly routes?: readonly ExecRoute[];
    readonly skillSettings?: SkillSettingsFn;
    readonly skillEnv?: SkillEnvFn;
    readonly realpath?: Realpath;
    readonly deniedRoots?: readonly string[];
    readonly skillsDir?: string;
}
export type SkillEnvFn = (skill: string) => Readonly<Record<string, string>> | undefined;
export declare function declaredEnv(declared: Readonly<Record<string, string>> | undefined, session: string | undefined): Record<string, string>;
export declare function createExecTool({ policyVersion, spawn, killProcess, shell: composedShell, languages, routes, skillSettings, skillEnv, realpath, deniedRoots, skillsDir }?: ExecToolOptions): ToolDefinition;
