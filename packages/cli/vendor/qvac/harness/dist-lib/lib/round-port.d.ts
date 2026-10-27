import type { ModelRoundPort } from './capabilities/completion-engine/index.ts';
import { type WireEvent } from './wire.ts';
export interface RoundFrame {
    type: string;
    callId?: string | null;
    message?: string | null;
    result?: unknown;
    payload?: unknown;
}
export declare class RoundPort {
    private readonly _push;
    private readonly _asked;
    private _calls;
    private _cut;
    private _closed;
    constructor(push: (event: WireEvent) => unknown);
    port: ModelRoundPort;
    roundCut: (cut: (note: string) => void) => void;
    frame(frame: RoundFrame): boolean;
    close(): void;
    private _retake;
    private _settle;
    private _take;
}
