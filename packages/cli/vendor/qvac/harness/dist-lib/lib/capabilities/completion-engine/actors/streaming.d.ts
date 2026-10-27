import type { CompletionArgs } from '../loop.ts';
import { type RoundFold } from '../round.ts';
import { type CompletionActor, type Session } from '../session.ts';
import type { RoundDonePayload } from '../stages.ts';
import { type CompletionContext } from '../../../machine/index.ts';
export declare const streaming: CompletionActor<RoundDonePayload>;
export declare function roundFold(args: CompletionArgs, session: Session, context: CompletionContext): RoundFold;
