import type { ToolDialect } from '../../schemas/index.js';
/**
 * The tool-call dialect a model's registry name or file name points to, or
 * undefined when neither matches a known pattern.
 */
export declare function matchToolDialectFromName(name: string | undefined, path: string): ToolDialect | undefined;
/**
 * The tool-call dialect for a GGUF `general.architecture` value, or undefined
 * for an architecture whose models use the default dialect.
 */
export declare function matchToolDialectFromArchitecture(architecture: string | undefined): ToolDialect | undefined;
/**
 * Resolves a model's tool-call dialect: its name first, then the
 * `general.architecture` in its GGUF header, then "hermes", whose parser chain
 * also covers unknown JSON-payload models. The header is read only when the
 * name does not match. Bypass with `completion({ toolDialect })`.
 */
export declare function resolveToolDialect(name: string | undefined, path: string): Promise<ToolDialect>;
