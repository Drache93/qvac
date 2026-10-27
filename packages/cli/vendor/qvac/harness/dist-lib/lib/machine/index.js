import { PLAN_MODE_REFUSAL } from './completion/actions/tools.js';
import { emptyCompletionContext } from './completion/context.js';
import { createCompletionMachine } from './completion/machine.js';
import { atContextBoundary, cutOffMessage, cutShort, MAX_ROUND_CALLS, MAX_ROUND_REPEATS, runsUnasked } from './completion/rules.js';
import { MACHINE_VERSION } from './completion/version.js';
import { completionMachineDefinition, transitionName } from './definition.js';
export class CompletionMachine {
    static VERSION = MACHINE_VERSION;
    static PLAN_MODE_REFUSAL = PLAN_MODE_REFUSAL;
    static create = createCompletionMachine;
    static definition = completionMachineDefinition;
    static emptyContext = emptyCompletionContext;
    static transitionName = transitionName;
    static runsUnasked = runsUnasked;
    static cutOffMessage = cutOffMessage;
    static cutShort = cutShort;
    static atContextBoundary = atContextBoundary;
    static MAX_ROUND_CALLS = MAX_ROUND_CALLS;
    static MAX_ROUND_REPEATS = MAX_ROUND_REPEATS;
}
