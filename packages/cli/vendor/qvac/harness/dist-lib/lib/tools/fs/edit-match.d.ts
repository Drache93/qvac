export interface EditRequest {
    readonly old: string;
    readonly replacement: string;
    readonly replaceAll: boolean;
}
export interface EditMatch {
    content: string;
    count: number;
    error: string | null;
}
export declare function editMatch(content: string, request: EditRequest): EditMatch;
