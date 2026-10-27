export declare const PYTHON_UNAVAILABLE_ERROR: string;
export declare const LANGUAGE_UNAVAILABLE_ERROR: string;
export declare const PIP_UNAVAILABLE_ERROR: string;
export declare function commandBin(command: string): string;
export declare function dashModule(command: string): string | null;
export declare function runsPip(command: string): boolean;
export declare function runsInterpreter(command: string): boolean;
export interface VideoToolCall {
    packages?: readonly string[] | undefined;
    python: boolean;
    network?: boolean;
}
export declare function videoToolError(command: string, { packages, python, network }: VideoToolCall): string | null;
export declare function shellDownloader(command: string): string | null;
export declare const SHELL_DOWNLOAD_NOTE = "The file was saved on this device's disk, not in the chat, so the user cannot see it.";
export declare function savesDownload(command: string): boolean;
export declare function shellOnlyError(command: string): string | null;
