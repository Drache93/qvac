import type { QvacApprovalRule } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from './mesh.ts';
export interface ResourceDescriptor {
    kind: string;
    label: string;
}
type PutApprovalRuleInput = Pick<QvacApprovalRule, 'toolName' | 'resourceKind' | 'resourcePattern' | 'decision' | 'expiresAt' | 'agentId' | 'effect'>;
export declare function listApprovalRules(store: Mesh): Promise<QvacApprovalRule[]>;
export declare function putApprovalRule(store: Mesh, input: PutApprovalRuleInput): Promise<QvacApprovalRule>;
export interface ApprovalRuleQuery {
    readonly toolName: string;
    readonly resource?: ResourceDescriptor | null;
    readonly agentId?: string;
    readonly memberId?: Buffer | null;
}
export declare function matchApprovalRule(rules: ReadonlyArray<QvacApprovalRule>, input: ApprovalRuleQuery, now?: number): QvacApprovalRule | null;
export {};
