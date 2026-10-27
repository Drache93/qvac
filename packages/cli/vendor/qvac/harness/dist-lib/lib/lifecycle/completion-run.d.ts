import { type AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { CompletionEvent } from '../contract/index.ts';
export interface CompletionRun {
    abort: () => void;
    close: () => Promise<void>;
    readonly started: boolean;
}
type CompletionIterator = AsyncGenerator<CompletionEvent, unknown, unknown>;
export declare function trackCompletion(createSource: (signal: BareAbortSignal) => CompletionIterator, signal: BareAbortSignal | undefined, onFinish: (run: CompletionRun) => void): TrackedCompletionResult;
interface TrackedCompletionResult {
    iterator: CompletionIterator;
    run: CompletionRun;
}
export {};
