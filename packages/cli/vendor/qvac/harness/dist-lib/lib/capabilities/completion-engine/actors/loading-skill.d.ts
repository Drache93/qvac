import { type CompletionActorInput } from '../session.ts';
import { type ToolExecutionPlan } from './execution-plan.ts';
import type { ToolDonePayload } from '../stages.ts';
export interface SkillCallPlan extends ToolExecutionPlan {
    skillName: string;
}
export declare function loadSkill({ emit, input: deps, context }: CompletionActorInput, plan: SkillCallPlan): Promise<ToolDonePayload>;
