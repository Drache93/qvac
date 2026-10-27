import type { ActorRefFrom, EventFrom, SnapshotFrom } from 'xstate';
import type { createCompletionMachine } from './machine.ts';
export type CompletionMachine = ReturnType<typeof createCompletionMachine>;
export type CompletionSnapshot = SnapshotFrom<CompletionMachine>;
export type CompletionActorRef = ActorRefFrom<CompletionMachine>;
export type CompletionAction = EventFrom<CompletionMachine>;
