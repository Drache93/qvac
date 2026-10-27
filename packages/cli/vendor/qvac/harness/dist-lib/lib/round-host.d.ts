import type { ModelRoundPort } from './capabilities/completion-engine/index.ts';
export declare class RoundHost {
    private readonly _port;
    private readonly _out;
    private readonly _rounds;
    constructor(port: ModelRoundPort, send: (frame: object) => void);
    ask(callId: string, payload: unknown): void;
    cancel(callId: string): void;
    close(): void;
    private _settle;
    private _drain;
}
