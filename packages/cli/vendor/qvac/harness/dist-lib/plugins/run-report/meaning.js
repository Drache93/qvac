export const MEANINGS = {
    'completion.active.idle': { says: 'Waiting for the run to start' },
    'completion.active.preparing': { says: 'Gets the run ready: tools, skills and files' },
    'completion.active.prepareChecking': { says: 'Checks whether a prepare step is needed first' },
    'completion.active.prepareRunning': { says: 'Runs the prepare step before the first round' },
    'completion.active.searching': { says: 'Runs a web search the request asked for outright' },
    'completion.active.retrieving': { says: 'Looks up what a follow-up question needs' },
    'completion.active.round': {
        says: 'Decides what is next: another model round, or wrapping up when time or rounds run out'
    },
    'completion.active.generating': { says: 'The model writes its reply' },
    'completion.active.resolving': {
        says: 'Reads the reply: tool calls to run, or an answer'
    },
    'completion.active.tools.selecting': { says: 'Picks the next queued tool call' },
    'completion.active.tools.batching': { says: 'Runs reads that need no approval together' },
    'completion.active.tools.inspecting': {
        says: 'Checks the call: a known tool, valid arguments, allowed, and whether a person must approve'
    },
    'completion.active.tools.rejecting': {
        says: 'Turns the call down before it runs; the model gets the reason and can try again',
        tone: 'trouble'
    },
    'completion.active.tools.approving': {
        says: 'Waits for a person to approve or decline the call',
        tone: 'person'
    },
    'completion.active.tools.executing': { says: 'Runs the tool and keeps its result' },
    'completion.active.answering': { says: 'Streams the answer' },
    'completion.active.wrapping': {
        says: 'Time or rounds ran out; asks the model for a final answer',
        tone: 'limit'
    },
    'completion.active.finishing': { says: 'Settles the run and its result' },
    'completion.active.history': { says: 'Returns to where the run was before it paused' },
    'completion.pausing': { says: 'Stopping safely so the run can resume later', tone: 'limit' },
    'completion.paused': { says: 'Paused; the run can resume from here', tone: 'limit' },
    'completion.resuming': { says: 'Picking the run back up' },
    'completion.done': { says: 'The run ended with an answer', tone: 'end' },
    'completion.failed': { says: 'The run ended with an error', tone: 'error' },
    'completion::any': { says: 'Routes that fire from any state, such as an error or a pause' },
    'completion.active::any': { says: 'Routes that fire from any active state, such as a pause' }
};
