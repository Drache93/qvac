const TIERS = [
    [12_288, 0.75],
    [16_384, 0.82],
    [32_768, 0.85],
    [65_536, 0.9]
];
const readings = new Map();
export class Fold {
    static FLOOR = 4_096;
    static TIERS = TIERS;
    static RATIO = 0.95;
    static KEEP_TURNS = 1;
    static KEEP_ROUNDS = 2;
    static PREFIX = '[Summary of the earlier conversation in this chat, written by another model. Treat it as established context, not as a new request.]';
    summarize;
    constructor(summarize) {
        this.summarize = summarize;
    }
    static turn(summary) {
        return `${Fold.PREFIX}\n\n${summary}`;
    }
    static isSummary(message) {
        return message.role === 'user' && message.content.startsWith(Fold.PREFIX);
    }
    static isTurn(message, nudges) {
        return (message.role === 'user' &&
            !Fold.isSummary(message) &&
            !nudges.includes(message.content) &&
            !Fold.carriesPlan(message, nudges));
    }
    static carriesPlan(message, nudges) {
        return (message.role === 'user' &&
            nudges.some((nudge) => message.content.startsWith(`${nudge}\nPlan:\n`)));
    }
    static ratio(ctxSize) {
        return TIERS.find(([below]) => ctxSize < below)?.[1] ?? Fold.RATIO;
    }
    static fits(ctxSize) {
        return ctxSize === undefined || ctxSize >= Fold.FLOOR;
    }
    static due({ cacheTokens, ctxSize, cutOff }) {
        if (cutOff)
            return true;
        if (!cacheTokens || !ctxSize)
            return false;
        return cacheTokens >= ctxSize * Fold.ratio(ctxSize);
    }
    static observe(cacheKey, reading) {
        readings.set(cacheKey, reading);
    }
    static reading(cacheKey) {
        return readings.get(cacheKey);
    }
    static forget(cacheKey) {
        readings.delete(cacheKey);
    }
    static boundary(messages, keepTurns = Fold.KEEP_TURNS) {
        const users = messages.flatMap((message, at) => message.role === 'user' && !Fold.isSummary(message) ? [at] : []);
        if (users.length <= keepTurns) {
            return null;
        }
        const end = users[users.length - keepTurns];
        return end > 0 ? { end, foldedTurns: users.length - keepTurns } : null;
    }
    static roundBoundary(messages, { nudges, keeps }, most = Infinity) {
        const task = messages.findLastIndex((message) => Fold.isTurn(message, nudges));
        if (task === -1) {
            return null;
        }
        const starts = messages.flatMap((message, at) => at > task && message.role === 'assistant' ? [at] : []);
        const plan = messages.findLastIndex((message, at) => at > task && Fold.carriesPlan(message, nudges));
        const kept = (from, to) => (plan >= from && plan < to) || messages.slice(from, to).some(keeps);
        const rounds = starts
            .map((from, index) => [from, starts[index + 1] ?? messages.length])
            .slice(0, Math.max(0, starts.length - Fold.KEEP_ROUNDS))
            .filter(([from, to]) => !kept(from, to))
            .slice(0, most);
        const summaries = messages.flatMap((message, at) => at > task && Fold.isSummary(message) ? [at] : []);
        const folded = rounds.flatMap(([from, to]) => Array.from({ length: to - from }, (_, offset) => from + offset));
        return { task, folded: [...summaries, ...folded], foldedRounds: rounds.length };
    }
    static prompt(messages, instructions) {
        const prior = messages.some(Fold.isSummary);
        const transcript = messages.map(transcribed).join('\n\n');
        return [
            'Summarize the conversation below so another model can continue it without seeing it.',
            prior
                ? 'The conversation carries an earlier summary. Carry everything from it that is still true into your new summary — it is discarded after this, so whatever you leave out is lost — and correct it where the later turns disagree.'
                : null,
            'Output exactly these four sections, in this order, keeping every heading even when it has nothing under it:',
            '## Objective\n## Facts and decisions\n## State\n## Next steps',
            'Rules: at most three bullets per section, at most fifteen words per bullet. Preserve names, numbers, file paths and identifiers exactly. Write "(none)" under a heading with nothing to say. Do not continue the conversation, do not answer anything asked in it, and do not mention summarizing.',
            instructions ? `Also: ${instructions}` : null,
            '<conversation>',
            transcript,
            '</conversation>'
        ]
            .filter((part) => part !== null)
            .join('\n\n');
    }
    static shrinks(folded, summary) {
        const replaced = folded.reduce((total, message) => total + message.content.length, 0);
        return Fold.turn(summary).length < replaced;
    }
    async *run(messages, options = {}) {
        if (!Fold.fits(options.ctxSize)) {
            return { folded: false, reason: 'below-floor' };
        }
        const opensWithSummary = messages[0] !== undefined && Fold.isSummary(messages[0]);
        const userTurns = messages.filter((message) => message.role === 'user' && !Fold.isSummary(message)).length;
        let keepTurns = Fold.KEEP_TURNS;
        let started = false;
        for (;;) {
            const boundary = Fold.boundary(messages, keepTurns);
            if (!boundary || (opensWithSummary && boundary.end <= 1)) {
                return { folded: false, reason: opensWithSummary ? 'already-compacted' : 'nothing-to-fold' };
            }
            const throughId = messages[boundary.end - 1].id;
            if (typeof throughId !== 'string' || !throughId) {
                return { folded: false, reason: 'no-id' };
            }
            const folded = messages.slice(0, boundary.end);
            if (!started) {
                yield { type: 'fold', phase: 'start' };
                started = true;
            }
            const attempt = await this.summarize(Fold.prompt(folded, options.instructions));
            const summary = attempt.text?.trim() || null;
            if (!summary) {
                if (attempt.overflowed && boundary.foldedTurns > 1) {
                    keepTurns = userTurns - Math.floor(boundary.foldedTurns / 2);
                    continue;
                }
                return { folded: false, reason: 'no-summary' };
            }
            if (!Fold.shrinks(folded, summary)) {
                return { folded: false, reason: 'summary-not-smaller' };
            }
            return {
                folded: true,
                summary,
                throughId,
                foldedTurns: boundary.foldedTurns,
                end: boundary.end
            };
        }
    }
    async rounds(messages, options) {
        if (!Fold.fits(options.ctxSize)) {
            return { folded: false, reason: 'below-floor' };
        }
        let most = Infinity;
        for (;;) {
            const boundary = Fold.roundBoundary(messages, options, most);
            if (!boundary?.foldedRounds) {
                const summarized = boundary !== null && boundary.folded.length > 0;
                return { folded: false, reason: summarized ? 'already-compacted' : 'nothing-to-fold' };
            }
            const folded = boundary.folded.map((at) => messages[at]);
            const attempt = await this.summarize(Fold.prompt([messages[boundary.task], ...folded], options.instructions));
            const summary = attempt.text?.trim() || null;
            if (!summary) {
                if (attempt.overflowed && boundary.foldedRounds > 1) {
                    most = Math.floor(boundary.foldedRounds / 2);
                    continue;
                }
                return { folded: false, reason: 'no-summary' };
            }
            if (!Fold.shrinks(folded, summary)) {
                return { folded: false, reason: 'summary-not-smaller' };
            }
            const history = spliced(messages, boundary, summary);
            return { folded: true, history, summary, foldedRounds: boundary.foldedRounds };
        }
    }
}
function spliced(messages, boundary, summary) {
    const gone = new Set(boundary.folded);
    return [
        ...messages.slice(0, boundary.task + 1),
        { role: 'user', content: Fold.turn(summary) },
        ...messages.filter((_, at) => at > boundary.task && !gone.has(at))
    ];
}
const SENDERS = { user: 'User', tool: 'Tool result' };
function transcribed(message) {
    const sender = message.role === 'user' && message.name ? `${message.name}: ` : '';
    return `${SENDERS[message.role] ?? 'Assistant'}: ${sender}${message.content}`;
}
