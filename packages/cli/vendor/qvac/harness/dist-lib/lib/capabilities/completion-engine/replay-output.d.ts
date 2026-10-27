import type { EngineEvent } from '../../machine/index.ts';
export interface ReplayedRoundText {
    contentText: string;
    thinkingText?: string;
}
interface ReplayEvent extends EngineEvent {
    text: string;
}
interface ReplayFinalRoundArgs {
    runId: string;
    round: number;
    last: ReplayedRoundText;
    response: string | undefined;
}
interface ReplaySuccessOutputArgs {
    runId: string;
    round: unknown;
    context: Record<string, unknown> | undefined;
    output: unknown;
}
export declare function readLastRoundText(context: Record<string, unknown> | undefined): ReplayedRoundText | undefined;
export declare function replayFinalRound(args: ReplayFinalRoundArgs): Generator<ReplayEvent>;
export declare function replaySuccessOutput(args: ReplaySuccessOutputArgs): Generator<ReplayEvent>;
export {};
