import { type CompletionContext } from '../../../machine/index.ts';
import type { ResolvedCallSnapshot, ToolExecutionSnapshot, ToolRejection } from '../stages.ts';
import type { ResourceDescriptor, ToolActivityEvent, ToolEffect } from '../../../contract/index.ts';
interface PolicyActivityInput {
    call: ResolvedCallSnapshot;
    effect: ToolEffect | undefined;
    resource: ResourceDescriptor | null;
    decision?: 'blocked' | 'denied';
}
export declare function policyActivity({ call, effect, resource, decision }: PolicyActivityInput): ToolActivityEvent;
export interface GateRejectionInput {
    context: CompletionContext;
    call: ResolvedCallSnapshot;
    execution: ToolExecutionSnapshot | null;
    resource: ResourceDescriptor | null;
    source: ToolRejection['source'];
}
export declare function gateRejection({ context, call, execution, resource, source }: GateRejectionInput): ToolRejection | undefined;
export declare function deniedWithoutApprover({ context, call, execution, source }: GateRejectionInput): ToolRejection | undefined;
export {};
