export interface ObsidianCommand {
    action: string;
    args: string[];
}
export declare function parseObsidianCommand(command: string): ObsidianCommand | null;
export declare function normalizeObsidianCommand(command: string): string;
