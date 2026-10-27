import { type ToolPolicyFacts } from '../../tool-plan.ts';
import type { CompletionActor, CompletionDeps } from '../session.ts';
import type { CompletionContext } from '../../../machine/index.ts';
import type { InspectingOutput, ResolvedCallSnapshot } from '../stages.ts';
import type { ResourceDescriptor } from '../../../contract/index.ts';
export type ToolInspection = InspectingOutput & Omit<ToolPolicyFacts, 'call'> & {
    resource: ResourceDescriptor | null;
};
export declare const inspecting: CompletionActor<ToolInspection>;
export declare function inspectCall(deps: CompletionDeps, context: CompletionContext, snapshot: ResolvedCallSnapshot): ToolInspection;
