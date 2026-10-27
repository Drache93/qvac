import { isRecord } from '../../lib/guards.js';
const TRANSFER = 'transfer_to_agent';
export function chain(models) {
    const first = models[0];
    const last = models[models.length - 1];
    if (models.length === 1) {
        return first;
    }
    const out = {
        ...first,
        run: { ...last.run, runId: first.run.runId, startedAt: first.run.startedAt },
        running: last.running,
        definition: models.find((model) => model.definition)?.definition ?? null,
        steps: [],
        visits: {},
        edges: {},
        story: { prompt: first.story.prompt, rounds: [], tools: [] },
        hops: []
    };
    let steps = 0;
    let rounds = 0;
    for (const [index, model] of models.entries()) {
        const reason = index === 0 ? '' : transferReason(models[index - 1]);
        out.hops.push({
            agent: model.run.agent,
            model: model.run.model,
            reason,
            round: rounds,
            step: (model.steps[0]?.index ?? 0) + steps
        });
        out.steps.push(...model.steps.map((step) => ({
            ...step,
            index: step.index + steps,
            round: step.round + rounds
        })));
        merge(out.visits, model.visits, steps);
        merge(out.edges, model.edges, steps);
        out.story.rounds.push(...model.story.rounds.map((round) => ({
            ...round,
            round: round.round + rounds,
            step: shift(round.step, steps),
            calls: round.calls.map((call) => ({
                ...call,
                round: call.round + rounds,
                step: shift(call.step, steps)
            }))
        })));
        out.story.tools.push(...model.story.tools);
        steps += (model.steps.at(-1)?.index ?? -1) + 1;
        rounds += model.story.rounds.length;
    }
    const tokens = models.map((model) => model.run.tokens);
    out.run.tools = [...new Set(models.flatMap((model) => model.run.tools))];
    out.run.rounds = models.reduce((sum, model) => sum + model.run.rounds, 0);
    out.run.tokens = tokens.includes(null)
        ? null
        : tokens.reduce((sum, n) => Number(sum) + Number(n), 0);
    return out;
}
function merge(into, from, by) {
    for (const [key, indexes] of Object.entries(from)) {
        into[key] = [...(into[key] ?? []), ...indexes.map((index) => index + by)];
    }
}
function shift(step, by) {
    return step === null ? null : step + by;
}
function transferReason(model) {
    const call = model.story.rounds
        .flatMap((round) => round.calls)
        .findLast((call) => call.name === TRANSFER);
    return isRecord(call?.args) ? String(call.args.reason ?? '') : '';
}
