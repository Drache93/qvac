import type { OutboundGuard } from '../contract/index.ts';
import type { TrustedOrigin, TrustedSource, TrustedSourceFacts } from '../contract/index.ts';
export declare const REFUSAL = "Refusing to send:";
export type { TrustedOrigin, TrustedSource };
export interface GuardOptions {
    readonly sources: readonly TrustedSource[];
    externalWrite?: boolean;
}
export interface GuardFactOptions extends GuardOptions {
    readonly sourceFacts?: readonly TrustedSourceFacts[];
}
export declare function trustedSourceFacts(origin: TrustedSourceFacts['origin'], text: string): TrustedSourceFacts;
export declare function guardToolCall(toolName: string, args: Record<string, unknown>, options: GuardOptions): string | null;
export declare function guardToolCallWithFacts(toolName: string, args: Record<string, unknown>, { sources, sourceFacts, externalWrite }: GuardFactOptions): string | null;
export declare const outboundGuard: OutboundGuard;
