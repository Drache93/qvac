import type { AgentConfig, AgentPolicy, AgentPorts, AgentRequest, AgentSkill, ResolvedAgent } from '../contract/index.ts';
export declare function agentPolicy(agent: AgentConfig | undefined): AgentPolicy;
export declare function resolveAgent<Skill extends AgentSkill>(request: AgentRequest<Skill>, ports: AgentPorts<Skill>): ResolvedAgent<Skill>;
