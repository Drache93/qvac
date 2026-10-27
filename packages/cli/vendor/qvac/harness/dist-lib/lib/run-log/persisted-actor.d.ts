import { type AnyStateMachine, type Actor } from 'xstate';
import { RunJournal } from './run-journal.ts';
import type { MachineLog } from './protocol-types.ts';
export interface PersistedActor<Machine extends AnyStateMachine> {
    actor: Actor<Machine>;
    persistence: {
        journal: RunJournal;
        checkpoint(): Promise<void>;
        flush(): Promise<void>;
        dispose(): Promise<void>;
    };
}
export declare function createPersistedActor<Machine extends AnyStateMachine>(core: MachineLog | RunJournal, machine: Machine, onFailure?: (error: Error) => void, now?: () => number): Promise<PersistedActor<Machine>>;
