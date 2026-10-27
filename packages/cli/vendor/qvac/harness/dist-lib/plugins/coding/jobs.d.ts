import type { ToolDefinition, ToolExecuteContext } from '../../lib/contract/index.ts';
import { type CodingSession, type SessionLine } from './session.ts';
interface JobRead {
    runId: string;
    id: unknown;
    since: number;
}
export declare class Jobs {
    private readonly _session;
    private readonly _jobs;
    private _next;
    constructor(session: CodingSession);
    private _ofRun;
    start(call: SessionLine): Promise<unknown>;
    private _stop;
    private _find;
    list(runId: string): unknown;
    output(read: JobRead, ctx: ToolExecuteContext | undefined): Promise<unknown>;
    stop(runId: string, id: unknown): Promise<unknown>;
    endRun(runId: string): Promise<void>;
    close(): Promise<void>;
}
export declare function shellJobsTool(session: CodingSession, jobs: Jobs): ToolDefinition;
export {};
