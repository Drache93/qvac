import { type CompletionActor } from '../session.ts';
import type { RoundDonePayload } from '../stages.ts';
export declare const WRAP_UP_PREDICT = 4096;
interface WrapUpOutput extends RoundDonePayload {
    response: string;
}
export declare const wrapUp: CompletionActor<WrapUpOutput>;
export {};
