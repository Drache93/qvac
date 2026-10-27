export declare const PYTHON_BIN_ERROR: string;
export declare const PACKAGES_NEED_PYTHON_ERROR: string;
export declare const FILES_NEED_PYTHON_ERROR: string;
export declare const DOWNLOAD_REMEDY = "To give the user a downloaded file, fetch it in exec with language \"python\" and declare it in outputs.";
export declare function downloaderShellError(tool: string): string;
export declare function pipError(command: string, sandbox?: boolean): string | null;
export declare function pythonRedirectError(command: string, sandbox?: boolean): string | null;
export declare function downloaderRedirect(command: string): string | null;
