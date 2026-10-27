import type { AgentHandoff, RunInput, TransferEvent } from '../contract/index.ts';
export declare const MAX_TRANSFERS = 3;
export interface FollowAgent {
    id?: string;
    handoffs?: AgentHandoff[] | null;
}
export interface FollowRequest {
    runId?: string;
    resume?: boolean;
    recovery?: unknown;
    agent?: FollowAgent;
    agents?: Readonly<Record<string, FollowAgent>>;
    messages?: ReadonlyArray<{
        role: string;
        content: string;
    }>;
    cacheKey?: string;
    input?: AsyncIterable<RunInput>;
    hopLog?: (hop: FollowHop) => object;
}
export interface FollowHop {
    index: number;
    agent: string;
}
export interface FollowEvent {
    type: string;
    runId?: unknown;
    name?: unknown;
    result?: unknown;
    id?: unknown;
    text?: unknown;
}
export interface FollowHost<Request, Event> {
    completion(request: Request): AsyncIterable<Event>;
}
export declare function follow<Request extends FollowRequest, Event extends FollowEvent>(host: FollowHost<Request, Event>, request: Request): AsyncGenerator<Event | TransferEvent>;
export declare function untransferred(text: string): string;
