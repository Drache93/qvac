/**
 * Check whether a resolved target path is contained within a base directory.
 * Portable — caller provides the resolve function and separator for their runtime.
 */
export declare function checkPathWithinBase(basePath: string, targetPath: string, resolveFn: (...args: string[]) => string, sep: string): boolean;
/**
 * Check whether a target path is contained within a base directory.
 * Both paths are resolved to absolute before comparison.
 */
export declare function isPathWithinBase(basePath: string, targetPath: string): boolean;
/**
 * Sanitize components, join them to a base path, and verify the result
 * stays within the base directory. Throws PathTraversalError on escape.
 */
export declare function validateAndJoinPath(basePath: string, ...components: string[]): string;
/**
 * Joins `name` under `basePath` without sanitizing it, so cache filenames stay
 * byte-stable. Throws PathTraversalError on a null byte or a `..` segment.
 */
export declare function joinWithinBase(basePath: string, name: string): string;
