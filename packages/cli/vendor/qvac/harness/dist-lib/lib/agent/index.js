import { createDelegateTool, DELEGATE_TOOL_NAME } from './delegate.js';
import { follow, MAX_TRANSFERS, untransferred } from './follow.js';
import { agentPolicy, resolveAgent } from './resolve.js';
import { MAX_PLAN_STEPS, PLAN_TOOL_NAME, planFromMessages, planSteps } from './plan.js';
import { parseToolGrant } from './tool-grants.js';
import { SKILL_TOOL_NAME, WEB_SEARCH_TOOL_NAME } from './tool-names.js';
import { collectToolGrants, enabledTools, NETWORK_TOOLSETS, permittedTools, skillIsActive } from './tool-selection.js';
import { TRANSFER_TOOL_NAME } from './transfer.js';
export class Agent {
    static SKILL_TOOL_NAME = SKILL_TOOL_NAME;
    static WEB_SEARCH_TOOL_NAME = WEB_SEARCH_TOOL_NAME;
    static TRANSFER_TOOL_NAME = TRANSFER_TOOL_NAME;
    static DELEGATE_TOOL_NAME = DELEGATE_TOOL_NAME;
    static PLAN_TOOL_NAME = PLAN_TOOL_NAME;
    static MAX_PLAN_STEPS = MAX_PLAN_STEPS;
    static NETWORK_TOOLSETS = NETWORK_TOOLSETS;
    static MAX_TRANSFERS = MAX_TRANSFERS;
    static resolve = resolveAgent;
    static policy = agentPolicy;
    static parseToolGrant = parseToolGrant;
    static enabledTools = enabledTools;
    static permittedTools = permittedTools;
    static collectToolGrants = collectToolGrants;
    static skillIsActive = skillIsActive;
    static follow = follow;
    static delegateTool = createDelegateTool;
    static untransferred = untransferred;
    static planSteps = planSteps;
    static planFromMessages = planFromMessages;
    config;
    ports;
    constructor(config, ports) {
        this.config = config;
        this.ports = ports;
    }
    resolve(request) {
        return resolveAgent({ ...request, agent: this.config }, this.ports);
    }
    policy() {
        return agentPolicy(this.config);
    }
}
