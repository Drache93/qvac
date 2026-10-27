import type { TargetEvent, TargetResult, TargetUsage } from '../../lib/agent/index.ts';
export interface AgentInfo {
    name: string;
    description: string;
}
export type Message = {
    type: 'hello';
    name: string;
    agents: AgentInfo[];
    people: boolean;
    proof: string;
} | {
    type: 'message';
    id: string;
    to: string;
    text: string;
    files: string[];
} | {
    type: 'event';
    id: string;
    event: TargetEvent;
} | {
    type: 'reply';
    id: string;
    status: TargetResult['status'];
    text: string;
    usage: TargetUsage;
    files: string[];
} | {
    type: 'cancel';
    id: string;
} | {
    type: 'ask';
    id: string;
    question: string;
} | {
    type: 'answer';
    id: string;
    text: string | null;
} | {
    type: 'settled';
    id: string;
};
export interface Frame {
    message: Message;
    bodies: Buffer[];
}
export interface Line {
    readonly name: string;
    readonly agents: readonly AgentInfo[];
    readonly people: boolean;
    send(message: Message, bodies?: Buffer[]): void;
    close(): void;
}
export interface Connection {
    readonly handshakeHash: Buffer;
    on(event: 'close' | 'error', listener: () => void): unknown;
    destroy(): void;
}
export interface TeamCrypto {
    hash(data: Buffer[]): Buffer;
    discoveryKey(key: Buffer): Buffer;
}
export interface LineOptions {
    crypto: TeamCrypto;
    team: Buffer;
    me: Pick<Line, 'name' | 'agents' | 'people'>;
    onOpen(line: Line): void;
    onFrame(line: Line, frame: Frame): void;
    onClose(line: Line): void;
}
export declare function openLine(connection: Connection, options: LineOptions): void;
