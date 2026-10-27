import type { ToolExecuteContext } from '../../lib/contract/index.ts';
import type { HarnessPlugin, PluginSetup } from '../../lib/plugins/index.ts';
import { type ObsidianPathProbe } from './readiness.ts';
import type { ExecRoute, ExecRouteOptions } from '../../lib/contract/exec.ts';
import { type ExecResult } from '../../lib/tools/exec/runner.ts';
interface CredentialRecord {
    readonly token: string;
}
type ObsidianCredential = CredentialRecord | string | null;
export type ObsidianCredentialStore = (key: string, ctx?: ToolExecuteContext) => Promise<ObsidianCredential> | ObsidianCredential;
export interface ObsidianRouteOptions {
    readonly credentialStore?: ObsidianCredentialStore | undefined;
    readonly platform?: string;
    readonly env?: Record<string, string | undefined>;
    readonly probe?: ObsidianPathProbe;
}
export declare class ObsidianRoute implements ExecRoute, HarnessPlugin {
    readonly name = "obsidian";
    readonly api = 1;
    private readonly _options;
    constructor(options?: ObsidianRouteOptions);
    setup(): PluginSetup;
    claims(command: string): boolean;
    run(command: string, ctx: ToolExecuteContext | undefined, { timeoutMs, maxOutputChars, signal, runtime }: ExecRouteOptions): Promise<ExecResult>;
}
export {};
