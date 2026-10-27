export declare const ARCHITECTURE_SCAN_BYTES: number;
/**
 * The `general.architecture` value from a GGUF header, read from at most the
 * first `ARCHITECTURE_SCAN_BYTES` of the file. Undefined when the file is
 * unreadable, is not GGUF, or does not name an architecture in that range.
 */
export declare function readGgufArchitecture(filePath: string): Promise<string | undefined>;
