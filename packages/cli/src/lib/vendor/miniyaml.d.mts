interface StringifyOptions {
    /** Spaces per indentation level. Defaults to 2; must be 1–10. */
    indent?: number;
    /** Maximum collection depth. Defaults to 100. */
    maxDepth?: number;
}
declare function stringify(input: unknown, options?: StringifyOptions): string;

interface ParseOptions {
    /** File path included in parsing errors. */
    filename?: string;
    /** Maximum collection nesting depth; defaults to 100. */
    maxDepth?: number;
    /** Maximum alias nodes per document; -1 (default) disables the limit. */
    maxAliases?: number;
    /** Allow duplicate mapping keys, keeping the last value; defaults to false. */
    json?: boolean;
}
declare function parse(source: string, options?: ParseOptions): unknown;

export { parse, stringify };
export type { ParseOptions, StringifyOptions };
