import type { DelegateTarget } from '../../lib/agent/index.ts';
import type { HarnessPlugin, PluginSetup } from '../../lib/plugins/index.ts';
import { type AgentTargetConfig } from './targets.ts';
declare module '../../lib/plugins/context.ts' {
    interface Services {
        delegateTargets: readonly DelegateTarget[];
    }
}
export type { AgentLogin, AgentProtocol, AgentTargetConfig } from './targets.ts';
export interface ExternalAgentsOptions {
    dir: string;
    targets: readonly AgentTargetConfig[];
}
type Preset = Pick<AgentTargetConfig, 'protocol' | 'command' | 'keyEnv' | 'description'>;
export declare class ExternalAgents implements HarnessPlugin {
    static readonly PRESETS: Readonly<Record<'claude-agent-acp' | 'codex-acp', Preset>>;
    static targets({ dir, targets }: ExternalAgentsOptions): DelegateTarget[];
    readonly name = "external-agents";
    readonly api = 1;
    readonly provides: string[];
    private readonly _options;
    constructor(options: ExternalAgentsOptions);
    validate(): string | null;
    setup(): PluginSetup;
}
