import { selectEnabledTools } from './tools.js';
import { collectToolGrants, isSelected, NETWORK_TOOLSETS, permittedTools, skillIsActive, skillsAreSelected } from './tool-selection.js';
import { createPlanTool } from './plan.js';
import { createTransferTool } from './transfer.js';
export function agentPolicy(agent) {
    return { skipApprovals: agent?.approvalMode === 'skip-all' };
}
export function resolveAgent(request, ports) {
    const { agent, userText, fsRoots, fsWriteRoots } = request;
    const disabledToolsets = request.policy?.network.mode === 'off'
        ? [...(agent?.disabledToolsets ?? []), ...NETWORK_TOOLSETS]
        : agent?.disabledToolsets;
    const writableRoots = [
        ...fsWriteRoots,
        ...fsRoots.filter((root) => root.kind === 'hyper' && root.writable && !fsWriteRoots.includes(root))
    ];
    const toggles = {
        skillsSelected: skillsAreSelected(agent?.skillsScope, Boolean(agent)),
        enabledSkills: agent?.enabledSkills ?? []
    };
    const activeSkills = request.skills.filter((skill) => skillIsActive(skill.name, toggles));
    const mention = ports.mention(userText, activeSkills);
    const activation = {
        ...toggles,
        mention: mention?.name ?? null,
        loadedSkills: new Set(request.loadedSkills)
    };
    const { grantedNames, grantedOwners, grantedOps } = collectToolGrants(activeSkills);
    const selection = {
        responseFormat: Boolean(request.responseFormat),
        tools: permittedTools([...request.tools], disabledToolsets),
        toolsSelected: isSelected(agent?.toolsScope, agent?.enabledTools),
        allowlist: agent?.enabledTools ?? [],
        activeSkills,
        grantedNames,
        grantedOwners,
        hasRoots: fsRoots.length > 0,
        hasWriteRoots: writableRoots.length > 0,
        capabilityProfile: request.capabilityProfile
    };
    const transfer = agent?.handoffs?.length && !request.responseFormat ? [createTransferTool(agent.handoffs)] : [];
    const plan = (agent?.plan || request.planning || request.planMode) && !request.responseFormat
        ? [createPlanTool()]
        : [];
    const select = (loaded) => [
        ...selectEnabledTools({ ...selection, loadedSkills: new Set(loaded) }),
        ...plan,
        ...transfer
    ];
    const systemFor = (loaded) => ports.systemPrompt({
        bio: agent?.bio,
        toolNames: select(loaded).map((tool) => tool.name),
        skills: activeSkills
    });
    const enabled = select(activation.loadedSkills);
    return {
        enabled,
        system: systemFor(activation.loadedSkills),
        activation,
        activeSkills,
        mention,
        preload: mention ?? ports.implicitSkill(userText, activeSkills),
        grantedOps,
        writableRoots,
        generationParams: generationParams(request, ports),
        policy: agentPolicy(agent),
        select,
        systemFor
    };
}
function generationParams({ agent, model, thinkingDefault, generationParams: override }, ports) {
    const resolved = ports.generationParams(model, settingEnabled(agent?.reasoning), settingEnabled(thinkingDefault));
    return override ? { ...resolved, ...override } : resolved;
}
function settingEnabled(value) {
    if (value === 'enabled') {
        return true;
    }
    if (value === 'disabled') {
        return false;
    }
    return undefined;
}
