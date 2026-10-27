import type { ActorRef, PromiseActorLogic, Snapshot } from 'xstate';
import type { CompletionActorOutputs, CompletionContext, CompletionMachineEvent } from './types.ts';
export type Stage = keyof CompletionActorOutputs;
type CompletionParentSnapshot = Snapshot<unknown> & {
    context: CompletionContext;
};
export type CompletionParent = Pick<ActorRef<CompletionParentSnapshot, CompletionMachineEvent>, 'send' | 'getSnapshot'>;
export interface InvocationInput {
    parent: CompletionParent;
}
export type CompletionActorLogic = {
    [S in Stage]: PromiseActorLogic<CompletionActorOutputs[S], InvocationInput>;
} & {
    cleanup: PromiseActorLogic<void, InvocationInput>;
    resume: PromiseActorLogic<void, InvocationInput>;
};
export {};
