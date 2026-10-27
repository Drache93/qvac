export interface ExtractedPage {
    readonly title: string | null;
    readonly text: string;
}
export declare function looksLikeHtml(body: string): boolean;
export declare function extractPageText(html: string): ExtractedPage;
