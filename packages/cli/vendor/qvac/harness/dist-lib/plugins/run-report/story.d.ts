export type Outcome = 'ok' | 'failed' | 'rejected' | 'denied' | 'pending' | 'running';
export interface StoryCall {
    round: number;
    id: string;
    name: string;
    args: unknown;
    outcome: Outcome;
    detail: string;
    result: unknown;
    approved: boolean | null;
    durationMs: number | null;
    step: number | null;
}
export interface StoryRound {
    round: number;
    text: string;
    calls: StoryCall[];
    durationMs: number | null;
    tokens: number | null;
    step: number | null;
}
export interface Problem {
    label: string;
    count: number;
}
export interface ToolTally {
    name: string;
    calls: number;
    outcomes: Record<Outcome, number>;
    problems: Problem[];
}
export interface Story {
    prompt: string;
    rounds: StoryRound[];
    tools: ToolTally[];
}
export interface SeenCall {
    name: string;
    args: unknown;
    step: number;
}
export interface StoryInput {
    context: Record<string, unknown>;
    calls: Map<string, SeenCall>;
    approvals: Map<string, boolean>;
    requests: Map<number, number>;
    running: boolean;
}
export declare function story(input: StoryInput): Story;
