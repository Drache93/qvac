export interface PageVideoRef {
    readonly provider: string;
    readonly url: string;
}
export declare function pageVideoRef(html: string, pageUrl: URL): PageVideoRef | null;
