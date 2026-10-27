export declare function encodeAgentSkillReadiness(agentId: string, readySkillNames: ReadonlyArray<string>): string[];
export declare function agentReadySkillNames(reported: ReadonlyArray<string> | null | undefined, agentId: string | null | undefined): ReadonlyArray<string> | null;
export declare function readinessForAgents(reported: ReadonlyArray<string>, agentIds: ReadonlySet<string>): string[];
