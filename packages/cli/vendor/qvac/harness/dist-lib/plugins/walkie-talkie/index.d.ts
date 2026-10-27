import type Hyperswarm from 'hyperswarm';
import type { TargetEvent } from '../../lib/agent/index.ts';
import type { HarnessPlugin, PluginSetup } from '../../lib/plugins/index.ts';
import { type Attachments, type Crew, type CrewOptions, type Outgoing, type Reply } from './crew.ts';
import { type AgentInfo } from './wire.ts';
declare module 'hyperswarm' {
    interface SwarmTopic {
        refresh(): Promise<void>;
    }
}
export type { Attachments, Crew, CrewOptions, Outgoing, Reply } from './crew.ts';
export type { AgentInfo } from './wire.ts';
export interface Incoming {
    from: string;
    to: string;
    text: string;
    attachments: Attachments;
}
export interface Responding {
    signal: AbortSignal;
    onEvent: (event: TargetEvent) => void;
}
export interface TeamAgent extends AgentInfo {
    respond(incoming: Incoming, responding: Responding): Promise<Reply>;
}
export interface Question {
    from: string;
    question: string;
    signal: AbortSignal;
}
export interface Answer {
    by: string | null;
    text: string | null;
}
export interface Sending {
    signal?: AbortSignal;
    onEvent?: (event: TargetEvent) => void;
}
export type WalkieEvent = {
    type: 'peer';
    name: string;
    agents: AgentInfo[];
    joined: boolean;
} | {
    type: 'sent';
    id: string;
    from: string;
    to: string;
    text: string;
    attachments: string[];
} | {
    type: 'event';
    id: string;
    event: TargetEvent;
} | {
    type: 'reply';
    id: string;
    to: string;
    reply: Reply;
    attachments: string[];
} | {
    type: 'ask';
    id: string;
    from: string;
    question: string;
} | {
    type: 'answer';
    id: string;
    by: string | null;
    text: string | null;
};
export interface WalkieTalkieOptions {
    team: string;
    name: string;
    serve?: readonly TeamAgent[];
    accept?: (incoming: Incoming) => Promise<boolean>;
    answer?: (question: Question) => Promise<string | null>;
    onEvent?: (event: WalkieEvent) => void;
    swarm?: Hyperswarm;
    bootstrap?: ReadonlyArray<{
        host: string;
        port: number;
    }>;
}
export declare class WalkieTalkie implements HarnessPlugin {
    readonly name = "walkie-talkie";
    readonly api = 1;
    readonly read: string[];
    private readonly _options;
    private readonly _serve;
    private readonly _self;
    private readonly _lines;
    private readonly _open;
    private readonly _closed;
    private readonly _calls;
    private readonly _asked;
    private readonly _working;
    private readonly _waiters;
    private readonly _dropped;
    private _stopped;
    constructor(options: WalkieTalkieOptions);
    validate(): string | null;
    setup(): Promise<PluginSetup>;
    agents(): AgentInfo[];
    crew(options?: CrewOptions): Crew;
    teammates(): string[];
    teammate(name: string): Promise<void>;
    send(to: string, { text, attachments }: Outgoing, sending?: Sending): Promise<Reply>;
    ask(question: string, signal?: Pick<AbortSignal, 'aborted' | 'addEventListener'>): Promise<Answer>;
    private _infos;
    private _emit;
    private _route;
    private _onOpen;
    private _onClose;
    private _resend;
    private _left;
    private _onFrame;
    private _replied;
    private _respond;
    private _reply;
    private _accepted;
    private _work;
    private _heard;
    private _passed;
    private _answer;
    private _askTool;
}
