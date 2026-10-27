import { type AnyMachineSnapshot, type AnyStateMachine } from 'xstate';
export type Verdict = 'taken' | 'rejected' | 'unchecked' | 'unevaluable';
export interface GuardPart {
    name: string;
    value: boolean | null;
}
export interface Candidate {
    key: string;
    source: string;
    targets: string[];
    guard: string | null;
    verdict: Verdict;
    value: boolean | null;
    parts: GuardPart[];
    facts: string;
    error?: string;
}
export interface Microstep {
    eventType: string;
    before: AnyMachineSnapshot;
    after: AnyMachineSnapshot;
    candidates: Candidate[];
}
interface Event extends Record<string, unknown> {
    type: string;
}
export declare function decide(machine: AnyStateMachine, before: AnyMachineSnapshot, event: Event): Microstep[];
export {};
