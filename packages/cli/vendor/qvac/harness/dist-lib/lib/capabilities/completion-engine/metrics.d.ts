import type { CompletionContext } from '../../machine/index.ts';
import type { MetricsEvent, RoundSpeed, RunOutcome } from '../../contract/index.ts';
import type { UsageBreakdown } from '../usage-breakdown.ts';
import type { LiveRound } from './round.ts';
export interface RunEnd {
    usage?: UsageBreakdown | null;
    outcome?: RunOutcome | null;
    cancelled?: RoundSpeed | null;
}
export declare function metricsEvent(state: CompletionContext['metrics'], wallMs: number, { usage, outcome, cancelled }?: RunEnd): MetricsEvent | null;
export declare function cancelledRound(live: LiveRound | null | undefined): RoundSpeed | null;
