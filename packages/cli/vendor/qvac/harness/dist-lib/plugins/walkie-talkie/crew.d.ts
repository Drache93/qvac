import type { TargetResult, TargetUsage } from '../../lib/agent/index.ts';
import type { ToolDefinition, ToolExecuteContext } from '../../lib/contract/index.ts';
import type { AgentInfo } from './wire.ts';
export type Attachments = Record<string, Buffer>;
export interface Outgoing {
    text: string;
    attachments?: Attachments;
}
export interface Reply {
    status: TargetResult['status'];
    text: string;
    attachments?: Attachments;
    usage?: TargetUsage;
}
export interface CrewOptions {
    attach?: (ctx: ToolExecuteContext | undefined) => Promise<Attachments>;
    receive?: (reply: Reply, from: string, ctx: ToolExecuteContext | undefined) => Promise<string | null>;
}
export interface Crew {
    tools: ToolDefinition[];
    stop(): void;
}
export interface Roster {
    agents(): AgentInfo[];
    send(to: string, outgoing: Outgoing, signal: AbortSignal): Promise<Reply>;
}
export declare function crew(roster: Roster, { attach, receive }?: CrewOptions): Crew;
