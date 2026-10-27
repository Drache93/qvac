import type { Tool as SdkTool } from '@qvac/inference';
export declare class ToolSets {
    sets: Map<string, {
        type: "function";
        name: string;
        description: string;
        deferLoading?: boolean | undefined;
        group?: string | undefined;
        parameters: {
            [x: string]: unknown;
            type: "object";
            properties: Record<string, {
                [x: string]: unknown;
                type?: "array" | "boolean" | "integer" | "null" | "number" | "object" | "string" | ("array" | "boolean" | "integer" | "null" | "number" | "object" | "string")[] | undefined;
                description?: string | undefined;
                enum?: (string | number | boolean | null)[] | undefined;
            }>;
            required?: string[] | undefined;
        };
    }[]>;
    add(tools: SdkTool[]): string;
    resolve(hash: string): SdkTool[] | undefined;
    static hash(tools: readonly SdkTool[]): string;
}
