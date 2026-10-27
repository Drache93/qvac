import type { CompletionEvent, CompletionSdk } from '../../../contract/index.ts';
import { type RecoveredRound, type RoundArgs, type RoundKind } from '../round.ts';
import { type ModelRoundPort } from '../model-round.ts';
import type { Session } from '../session.ts';
interface ForwardStreamOptions<Result> {
    stream: AsyncGenerator<CompletionEvent, Result> | Generator<CompletionEvent, Result>;
    emit: (event: CompletionEvent) => void;
}
interface RunRoundOptions {
    sdk: CompletionSdk | undefined;
    modelRound?: ModelRoundPort | undefined;
    kind: RoundKind;
    args: Omit<RoundArgs, 'live' | 'knownTools'>;
    session: Pick<Session, 'liveRound' | 'enabled' | 'runId'>;
    emit: (event: CompletionEvent) => void;
}
export interface AssembleAnswerOptions {
    contentText: string;
    replay: string;
    landed: string[];
    emit: (event: CompletionEvent) => void;
}
export declare function forwardStream<Result>({ stream, emit }: ForwardStreamOptions<Result>): Promise<Result>;
export declare function runRound({ sdk, modelRound, kind, args, session, emit }: RunRoundOptions): Promise<RecoveredRound>;
export declare function assembleAnswer({ contentText, replay, landed, emit }: AssembleAnswerOptions): Promise<string>;
export {};
