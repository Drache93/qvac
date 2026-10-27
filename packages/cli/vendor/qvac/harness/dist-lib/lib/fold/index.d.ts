import type { FoldEvent, Message } from '../contract/index.ts';
export interface FoldReading {
    cacheTokens: number | undefined;
    ctxSize: number | undefined;
    cutOff?: boolean | undefined;
}
export interface FoldSummary {
    text: string | null;
    overflowed: boolean;
}
export type Summarize = (prompt: string) => Promise<FoldSummary>;
export type FoldRefusal = 'below-floor' | 'no-id' | 'nothing-to-fold' | 'already-compacted' | 'no-summary' | 'summary-not-smaller';
export interface FoldBoundary {
    end: number;
    foldedTurns: number;
}
export type FoldResult = {
    folded: true;
    summary: string;
    throughId: string;
    foldedTurns: number;
    end: number;
} | {
    folded: false;
    reason: FoldRefusal;
};
export interface FoldOptions {
    ctxSize?: number | undefined;
    instructions?: string | undefined;
}
export interface RoundsBoundary {
    task: number;
    folded: number[];
    foldedRounds: number;
}
export interface RoundsOptions extends FoldOptions {
    nudges: readonly string[];
    keeps: (message: Message) => boolean;
}
export type RoundsResult = {
    folded: true;
    history: Message[];
    summary: string;
    foldedRounds: number;
} | {
    folded: false;
    reason: FoldRefusal;
};
export declare class Fold {
    static FLOOR: number;
    static TIERS: readonly (readonly [below: number, ratio: number])[];
    static RATIO: number;
    static KEEP_TURNS: number;
    static KEEP_ROUNDS: number;
    static PREFIX: string;
    summarize: Summarize;
    constructor(summarize: Summarize);
    static turn(summary: string): string;
    static isSummary(message: Pick<Message, 'role' | 'content'>): boolean;
    static isTurn(message: Pick<Message, 'role' | 'content'>, nudges: readonly string[]): boolean;
    static carriesPlan(message: Pick<Message, 'role' | 'content'>, nudges: readonly string[]): boolean;
    static ratio(ctxSize: number): number;
    static fits(ctxSize: number | undefined): boolean;
    static due({ cacheTokens, ctxSize, cutOff }: FoldReading): boolean;
    static observe(cacheKey: string, reading: FoldReading): void;
    static reading(cacheKey: string): FoldReading | undefined;
    static forget(cacheKey: string): void;
    static boundary(messages: readonly Message[], keepTurns?: number): FoldBoundary | null;
    static roundBoundary(messages: readonly Message[], { nudges, keeps }: Pick<RoundsOptions, 'nudges' | 'keeps'>, most?: number): RoundsBoundary | null;
    static prompt(messages: readonly Message[], instructions?: string): string;
    static shrinks(folded: readonly Message[], summary: string): boolean;
    run(messages: readonly Message[], options?: FoldOptions): AsyncGenerator<FoldEvent, FoldResult>;
    rounds(messages: readonly Message[], options: RoundsOptions): Promise<RoundsResult>;
}
