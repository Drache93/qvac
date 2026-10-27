import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
export interface EgressProxyOptions {
    readonly hosts: readonly string[];
    readonly signal?: BareAbortSignal;
}
export interface EgressProxySession {
    readonly port: number;
    denied(): readonly string[];
    close(): Promise<void>;
}
export interface EgressProxyService {
    open(options: EgressProxyOptions): Promise<EgressProxySession>;
}
