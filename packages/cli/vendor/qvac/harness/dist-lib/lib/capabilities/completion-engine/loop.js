import process from 'process';
import { unnamedWrites, writeReport } from '../../helpers/run-outcome.js';
import { fallbackToolLabel } from '../../helpers/tool-label.js';
import { imageSettingsFrom } from '../../helpers/image-settings.js';
export function labelOf(name, args, emoji) {
    const display = { label: fallbackToolLabel(name, args) };
    return emoji ? { ...display, iconEmoji: emoji } : display;
}
export function skillEmojiFrom(catalog, name) {
    return catalog.find((entry) => entry.name === name)?.emoji ?? null;
}
export function* reportUnnamedWrites(said, landed) {
    const unreported = writeReport(unnamedWrites(said, landed));
    if (unreported) {
        yield { type: 'content', text: unreported };
    }
}
export function* reportLandedWrites(landed) {
    const written = writeReport(landed);
    if (written) {
        yield { type: 'content', text: written };
    }
}
const RUN_WALL_CLOCK_BUDGET_MS = 30 * 60_000;
export function createRunBudget(startedAt, ms) {
    const override = Number(process.env.QVAC_RUN_BUDGET_MS);
    const fallback = Number.isFinite(override) && override > 0 ? override : RUN_WALL_CLOCK_BUDGET_MS;
    return { deadlineMs: startedAt + (ms ?? fallback), outputBytesUsed: 0 };
}
export function runToolContext(args, runBudget) {
    const { agent, attach, fetchAttachment, progress, askUser, signal } = args;
    const image = imageSettingsFrom(agent);
    const session = args.session ?? sessionOf(args.cacheKey);
    return (turnImages = [], ctxSize, invocationSignal) => {
        const context = {
            agentId: agent?.id ?? null,
            ctxSize,
            fsRoots: args.fsRoots ?? [],
            fsWriteRoots: args.fsWriteRoots ?? [],
            runBudget,
            signal: invocationSignal ?? signal
        };
        if (session) {
            context.session = session;
        }
        if (image) {
            context.image = image;
        }
        if (turnImages.length) {
            context.turnImages = turnImages;
        }
        if (attach) {
            context.attach = attach;
        }
        if (fetchAttachment) {
            context.fetchAttachment = fetchAttachment;
        }
        if (progress) {
            context.progress = progress;
        }
        if (askUser) {
            context.askUser = askUser;
        }
        return context;
    };
}
function sessionOf(cacheKey) {
    return cacheKey?.split('/')[0] || undefined;
}
