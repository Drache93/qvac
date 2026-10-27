export const DIAGRAM_REPAIR_PROMPT_PREFIX = '<!-- qvac:diagram-repair:';
export const DIAGRAM_REPAIR_PROMPT_SUFFIX = 'Rewrite the complete previous answer with corrected Mermaid code blocks. Preserve all non-diagram content. Return only the corrected answer. Do not call tools.\n' +
    'Common fixes: put every label with spaces or punctuation in double quotes like A["Send (HTTP)"]; never use lowercase end as a node label - write "End"; the first line inside the fence must be the diagram type; close the fence before any prose - never leave a sentence inside it; give every node a unique id.';
export function diagramRepairPromptCount(content, parentRunId) {
    const match = /^<!-- qvac:diagram-repair:(\d+):([^\s>]+) -->\n(\d+) Mermaid diagram(?:s)? in your previous answer fail(?:s)? to render\.\n/.exec(content);
    if (!match || !content.endsWith(`\n\n${DIAGRAM_REPAIR_PROMPT_SUFFIX}`)) {
        return null;
    }
    const expected = Number(match[1]);
    return Number.isSafeInteger(expected) &&
        expected > 0 &&
        Number(match[3]) > 0 &&
        (!parentRunId || match[2] === parentRunId)
        ? expected
        : null;
}
export function isDiagramRepairPrompt(content) {
    return diagramRepairPromptCount(content) !== null;
}
export function completeMermaidDiagramCount(content) {
    const fence = /^[ \t]{0,3}(`{3,}|~{3,})[ \t]*mermaid[ \t]*\r?\n([\s\S]*?)^[ \t]{0,3}\1[ \t]*$/gm;
    return [...content.matchAll(fence)].filter((match) => match[2]?.trim()).length;
}
export function diagramRepairAccepted(text) {
    return completeMermaidDiagramCount(text) > 0;
}
export function diagramRepairLinks(records, textOf) {
    const ordered = [...records].sort((left, right) => left.seq - right.seq);
    const byId = new Map(ordered.map((record) => [record.id, record]));
    const used = new Set();
    return ordered.flatMap((child) => {
        if (!child.runId || !child.parentId)
            return [];
        const parent = byId.get(child.parentId);
        if (!parent?.runId) {
            return [];
        }
        const prompt = [...ordered]
            .reverse()
            .find((candidate) => candidate.seq > parent.seq &&
            candidate.seq < child.seq &&
            !used.has(candidate.id) &&
            diagramRepairPromptCount(textOf(candidate) ?? '', parent.runId ?? undefined) !== null);
        const promptText = prompt ? textOf(prompt) : null;
        const expectedCount = diagramRepairPromptCount(promptText ?? '', parent.runId);
        if (prompt) {
            used.add(prompt.id);
        }
        return prompt && promptText && expectedCount
            ? [
                {
                    expectedCount,
                    parentId: child.parentId,
                    promptId: prompt.id,
                    promptText,
                    runId: child.runId
                }
            ]
            : [];
    });
}
