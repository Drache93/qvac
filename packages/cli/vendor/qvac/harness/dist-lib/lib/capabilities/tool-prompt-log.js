import { HarnessLog } from '../log.js';
export function logToolPrompt({ promptPrefix, modelId, cacheKey, agentId, messageCount, responseFormat, tools = [], definitions, activeSkills, skillsSelected, enabledSkills, mentionedSkill, loadedSkills, toolOps }) {
    if (!HarnessLog.enabled('debug'))
        return;
    HarnessLog.debug('sdk tool definitions', {
        promptPrefix,
        modelId,
        cacheKey: cacheKey ?? null,
        agentId: agentId ?? null,
        messageCount,
        responseFormat: responseFormat ?? 'text',
        schemaChars: tools.length ? JSON.stringify(tools).length : 0,
        tools: rankedTools(tools, definitions),
        skillGatedChars: skillGatedChars(tools, definitions),
        activeSkills,
        skillActivation: {
            scope: skillsSelected ? 'selected' : 'all',
            enabled: enabledSkills,
            mentioned: mentionedSkill,
            loaded: [...loadedSkills]
        },
        localCliValidators: [...toolOps].map(([bin, validators]) => ({
            bin,
            count: validators.length
        }))
    });
}
function ownerOf(definitions, name) {
    return definitions.find((definition) => definition.name === name);
}
function rankedTools(tools, definitions) {
    return tools
        .map((tool) => {
        const owner = ownerOf(definitions, tool.name);
        return {
            name: tool.name,
            schemaChars: JSON.stringify(tool).length,
            descriptionChars: descriptionChars(tool),
            parameters: Object.keys(tool.parameters.properties),
            required: tool.parameters.required ?? [],
            skillGated: owner?.skillGated === true,
            owningSkill: owner?.owningSkill ?? null
        };
    })
        .sort((a, b) => b.schemaChars - a.schemaChars);
}
function skillGatedChars(tools, definitions) {
    let chars = 0;
    for (const tool of tools) {
        if (ownerOf(definitions, tool.name)?.skillGated !== true)
            continue;
        chars += JSON.stringify(tool).length;
    }
    return chars;
}
function descriptionChars(tool) {
    let chars = tool.description.length;
    for (const parameter of Object.values(tool.parameters.properties)) {
        chars += parameter.description?.length ?? 0;
    }
    return chars;
}
