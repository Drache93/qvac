export { ensureWithinRoot, writeNewFileText } from './safe-path.ts';
export declare const FRONTMATTER_RE: RegExp;
export declare function resolveNotePath(vaultPath: string, args: string[]): string | null;
export declare function readFileText(filePath: string): string;
export interface FileSnapshot {
    readonly text: string;
    readonly mtimeMs: number;
}
export declare function readFileSnapshot(filePath: string): FileSnapshot | null;
export declare function writeIfUnchanged(filePath: string, content: string, expectedMtimeMs: number | null): void;
export declare function updateFileText(filePath: string, transform: (existing: string) => string): void;
export declare function appendToFile(filePath: string, content: string): void;
export declare function moveFile(src: string, dest: string): void;
export declare function listMarkdownFiles(dir: string, prefix?: string): string[];
export declare function listFolders(dir: string, prefix?: string): string[];
export declare function parseFrontmatter(content: string): Record<string, string>;
export declare function getContentArg(args: string[]): string;
export declare function getArg(args: string[], key: string): string | undefined;
export declare function todayStamp(): string;
export declare function dailyCandidates(vaultPath: string, dateStr: string): Iterable<string>;
