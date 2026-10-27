import { unreadySkillState } from './skill-entry.js';
import { unquoteArg } from '../helpers/model-args.js';
import { mainFileRequested, skillFileArg, skillFileStem } from '../tools/skill.js';
import { Agent } from '../agent/index.js';
import { detachJson } from '../helpers/detach-json.js';
const MAX_WEB_SEARCHES_PER_TURN = 3;
const WEB_SEARCH_LIMIT_MESSAGE = 'Web search limit reached for this question. Answer now from the results already gathered. ' +
    'If something was not found, say so plainly and mention the most relevant sources. ' +
    'Do not call web_search again.';
function skillCallFacts({ skillCall, skillName, args, fileKey, tool, reloaded, opts }) {
    const skillActive = Agent.skillIsActive(skillName, opts.activation);
    return {
        skillAlreadyLoaded: tool?.name === Agent.SKILL_TOOL_NAME && reloaded,
        skillStatus: skillCall ? unreadySkillState(skillName, opts.skillCatalog) : null,
        skillActive,
        skillName: tool?.name === Agent.SKILL_TOOL_NAME ? skillName : '',
        alreadyLoadedLabel: fileKey === null ? skillName : `${skillName} ${unquoteArg(skillFileArg(args))}`,
        unavailableSkillMessage: skillCall && (!tool || !skillActive)
            ? blockedSkillMessage(skillName, opts.skillCatalog, opts.shownSkills)
            : ''
    };
}
function blockedSkillMessage(name, catalog, shownSkills) {
    if (catalog.some((entry) => entry.name === name)) {
        return (`skill "${name}" is not enabled for this agent. Do not rebuild what it does with another ` +
            `tool — answer from what you already have, or tell the user to enable it in Skills.`);
    }
    return shownSkills.length > 0
        ? `there is no skill named "${name}". The skills are: ${shownSkills.join(', ')}. Load one ` +
            `of them by that exact name, or answer from what you already have.`
        : `there is no skill named "${name}". You were not shown a skills list, which means no ` +
            `skill is available this turn — do not guess another name, and answer from what you ` +
            `already have.`;
}
export function planToolCall(resolved, opts) {
    const { call, tool, args, rejection } = resolved;
    const skillCall = call.name === Agent.SKILL_TOOL_NAME;
    const effect = tool?.effect(detachJson(args), opts.context) ?? (skillCall ? 'read' : undefined);
    const source = skillCall ? 'skill' : 'tool-result';
    const skillName = skillNameOf(args);
    const fileKey = skillFileKey(skillName, args);
    const reloaded = fileKey === null ? opts.loadedThisTurn.has(skillName) : opts.loadedFilesThisTurn.has(fileKey);
    const skillFacts = skillCallFacts({ skillCall, skillName, args, fileKey, tool, reloaded, opts });
    return {
        call: {
            id: call.id,
            key: resolved.key,
            name: call.name,
            args,
            rawCall: call.raw,
            intent: resolved.intent,
            rejection
        },
        toolAvailable: Boolean(tool),
        skillCall,
        ...skillFacts,
        searchCapReached: tool?.name === Agent.WEB_SEARCH_TOOL_NAME && opts.webSearches >= MAX_WEB_SEARCHES_PER_TURN,
        searchCapMessage: WEB_SEARCH_LIMIT_MESSAGE,
        hookRejection: rejection ?? null,
        source,
        effect
    };
}
export function skillNameOf(args) {
    return unquoteArg(args.name ?? args.skill_name ?? args.skill);
}
export function withCatalogSkillName(call, catalog) {
    if (call.name !== Agent.SKILL_TOOL_NAME)
        return call;
    const asked = skillNameOf(call.arguments).toLowerCase();
    const entry = catalog.find((skill) => skill.name.toLowerCase() === asked) ??
        catalog.find((skill) => skill.displayName?.toLowerCase() === asked) ??
        soleGrantingSkill(catalog, asked);
    return entry && entry.name !== call.arguments.name
        ? { ...call, arguments: { ...call.arguments, name: entry.name } }
        : call;
}
function soleGrantingSkill(catalog, toolName) {
    const owners = catalog.filter((skill) => skill.tools.some((grant) => Agent.parseToolGrant(grant).name === toolName));
    return owners.length === 1 ? owners[0] : undefined;
}
export function skillFileKey(skillName, args) {
    const file = skillFileArg(args);
    return mainFileRequested(skillName, file)
        ? null
        : `${skillName}\0${skillFileStem(unquoteArg(file))}`;
}
