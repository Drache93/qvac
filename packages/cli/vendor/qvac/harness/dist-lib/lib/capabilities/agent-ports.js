import { resolveLlmGenerationParams } from '../models/llm-presets.js';
import { skillsPromptSection, systemPromptParts } from '../prompt.js';
import { resolveImplicitSkill, resolveSkillMention } from '../tools/skills/mention.js';
export const defaultAgentPorts = {
    generationParams: resolveLlmGenerationParams,
    systemPrompt: ({ bio, toolNames, skills }) => systemPromptParts({ bio, toolNames, skillsSection: skillsPromptSection(skills) }),
    mention: resolveSkillMention,
    implicitSkill: resolveImplicitSkill
};
