import { toolDialectFor } from '../models/model-catalog.js';
import { detectToolDialect } from '../models/tool-dialect.js';
const QWEN35 = { prose: 4.38, schema: 4.08, toolBlockTokens: 189 };
const DENSITY_BY_DIALECT = new Map([['qwen35', QWEN35]]);
export function densityFor(modelName) {
    const dialect = modelName
        ? (toolDialectFor(modelName) ?? detectToolDialect(modelName, modelName))
        : undefined;
    return (dialect && DENSITY_BY_DIALECT.get(dialect)) ?? QWEN35;
}
export function promptUsageParts({ system, toolSchemas }) {
    return {
        systemPrompt: system.text.length - system.bioChars - system.skillsChars,
        agentInstructions: system.bioChars,
        activeSkills: system.skillsChars,
        toolSchemas: (toolSchemas ?? []).reduce((total, schema) => total + JSON.stringify(schema).length, 0)
    };
}
export function usageBreakdown(chars, totalTokens, modelName) {
    if (!totalTokens || totalTokens <= 0)
        return null;
    const density = densityFor(modelName);
    const prose = (value) => Math.round(value / density.prose);
    const rows = {
        systemPrompt: prose(chars.systemPrompt),
        agentInstructions: prose(chars.agentInstructions),
        activeSkills: prose(chars.activeSkills),
        tools: chars.toolSchemas > 0
            ? Math.round(chars.toolSchemas / density.schema) + density.toolBlockTokens
            : 0
    };
    const prompt = rows.systemPrompt + rows.agentInstructions + rows.activeSkills + rows.tools;
    if (prompt > totalTokens) {
        return scaledToWindow(rows, totalTokens);
    }
    return { ...rows, conversation: totalTokens - prompt, totalTokens };
}
function scaledToWindow(rows, totalTokens) {
    const scale = totalTokens / (rows.systemPrompt + rows.agentInstructions + rows.activeSkills + rows.tools);
    const scaled = {
        systemPrompt: Math.floor(rows.systemPrompt * scale),
        agentInstructions: Math.floor(rows.agentInstructions * scale),
        activeSkills: Math.floor(rows.activeSkills * scale),
        tools: Math.floor(rows.tools * scale)
    };
    const prompt = scaled.systemPrompt + scaled.agentInstructions + scaled.activeSkills + scaled.tools;
    return { ...scaled, conversation: totalTokens - prompt, totalTokens };
}
