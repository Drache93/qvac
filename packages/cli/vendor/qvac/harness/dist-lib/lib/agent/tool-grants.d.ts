export interface ToolGrant {
    name: string;
    scope: string | null;
}
export declare function parseToolGrant(entry: string): ToolGrant;
