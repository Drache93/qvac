interface Fs {
    mkdirTree(path: string): void;
    chdir(path: string): void;
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string, opts: {
        encoding: 'binary';
    }): Uint8Array;
    analyzePath(path: string): {
        exists: boolean;
    };
    readdir(path: string): string[];
    stat(path: string): {
        mode: number;
        size: number;
    };
    lstat(path: string): {
        mode: number;
    };
    isDir(mode: number): boolean;
    isLink(mode: number): boolean;
    unlink(path: string): void;
    rmdir(path: string): void;
}
interface CwdFs extends Fs {
    cwd(): string;
}
export interface Scratch {
    readonly dir: string;
    readonly cwd: string;
    [Symbol.dispose](): void;
}
interface InputFile {
    readonly path: string;
    readonly bytes: Uint8Array;
}
export declare function nextScratchDir(fs: Pick<Fs, 'analyzePath'>): string;
export declare function stageInputFiles(fs: Fs, dir: string, inputs: readonly InputFile[]): void;
export interface CollectedOutputs {
    files: Map<string, Uint8Array>;
    missing: string[];
    rejected: {
        name: string;
        reason: string;
    }[];
}
export declare function collectOutputs(fs: Fs, dir: string, names: readonly string[]): CollectedOutputs;
export declare function removeScratch(fs: Fs, dir: string, previousCwd: string): void;
export declare function openScratch(fs: CwdFs, workdir?: string): Scratch;
export {};
