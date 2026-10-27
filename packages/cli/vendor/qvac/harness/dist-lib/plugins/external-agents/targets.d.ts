import type { DelegateTarget, TargetResult, TargetTask } from '../../lib/agent/index.ts';
import { type AgentProcess } from './process.ts';
export type AgentProtocol = 'acp' | 'claude' | 'codex';
export type AgentLogin = 'isolated' | 'user';
export interface AgentTargetConfig {
    name: string;
    description: string;
    protocol: AgentProtocol;
    command: string;
    args?: readonly string[];
    keyEnv?: string;
    key?: () => Promise<string | null>;
    maxTurns?: number;
    maxCostUsd?: number;
    graceMs?: number;
    login?: AgentLogin;
}
export interface Drive {
    config: AgentTargetConfig;
    child: AgentProcess;
    task: TargetTask;
    signal: AbortSignal;
}
export type Driver = (drive: Drive) => Promise<TargetResult>;
export interface Protocol {
    argv(task: TargetTask, config: AgentTargetConfig): string[];
    drive: Driver;
}
export declare function graceMs(config: AgentTargetConfig): number;
export declare function targetKey(config: AgentTargetConfig): Promise<string | null>;
export declare function agentTarget(config: AgentTargetConfig, dir: string, { argv, drive }: Protocol): DelegateTarget;
export declare const acpDriver: Driver;
