import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
export type HostResolver = (hostname: string) => Promise<readonly string[]>;
export interface OutboundUrlOptions {
    readonly resolveHost?: HostResolver | undefined;
    readonly signal?: BareAbortSignal | undefined;
    readonly hosts?: readonly string[] | undefined;
}
export interface OutboundUrlCheck {
    readonly blocked: string | null;
    readonly addresses?: readonly string[];
}
export declare function checkOutboundHost(url: URL): string | null;
export declare function resolveOutboundUrl(url: URL, { resolveHost, signal, hosts }?: OutboundUrlOptions): Promise<OutboundUrlCheck>;
