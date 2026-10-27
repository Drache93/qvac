import { diagramRepairAccepted, diagramRepairLinks, isDiagramRepairPrompt } from '@qvac/harness/lib/diagram-repair.ts';
import { hiddenTranscriptText } from './transcript-visibility.js';
export function historyBranches(all, currentRunId) {
    const seqById = new Map(all.map((chunk) => [chunk.id, chunk.seq]));
    const repairs = diagramRepairLinks(all.filter((chunk) => chunk.type === 'user-message' || chunk.type === 'run-request'), (chunk) => chunk.userMessage?.text ?? null);
    const repairByRunId = new Map(repairs.map((repair) => [repair.runId, repair]));
    const hiddenChunkIds = new Set(all
        .filter((chunk) => isDiagramRepairPrompt(chunk.userMessage?.text ?? ''))
        .map((chunk) => chunk.id));
    const hiddenText = hiddenTranscriptText(all);
    const replyText = (target) => all
        .filter((chunk) => chunk.runId === target && chunk.content && !hiddenText.has(chunk.id))
        .map((chunk) => chunk.content?.text ?? '')
        .join('');
    const completed = (target) => all.some((chunk) => chunk.type === 'run-status' &&
        chunk.runId === target &&
        chunk.runStatus?.state === 'completed');
    const rejectedRunIds = new Set(repairs
        .filter((repair) => repair.runId !== currentRunId &&
        !(completed(repair.runId) && diagramRepairAccepted(replyText(repair.runId))))
        .map((repair) => repair.runId));
    const deadRanges = [];
    for (const chunk of all) {
        const repair = chunk.runId ? repairByRunId.get(chunk.runId) : undefined;
        if (repair && (repair.runId === currentRunId || rejectedRunIds.has(repair.runId))) {
            continue;
        }
        const start = chunk.parentId ? seqById.get(chunk.parentId) : undefined;
        if (start !== undefined) {
            deadRanges.push([start, chunk.seq]);
        }
    }
    return { repairs, repairByRunId, hiddenChunkIds, rejectedRunIds, deadRanges };
}
export function isPromptChunk(chunk, branches) {
    if (chunk.compaction)
        return true;
    return (!branches.hiddenChunkIds.has(chunk.id) &&
        !(chunk.runId && branches.rejectedRunIds.has(chunk.runId)) &&
        !branches.deadRanges.some(([start, end]) => chunk.seq >= start && chunk.seq < end));
}
export function acceptedRepairCount(branches, currentRunId) {
    return branches.repairs.filter((repair) => repair.runId !== currentRunId && !branches.rejectedRunIds.has(repair.runId)).length;
}
