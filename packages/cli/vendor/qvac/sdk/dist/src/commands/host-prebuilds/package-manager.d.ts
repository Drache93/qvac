export type PackageManagerName = 'npm' | 'pnpm' | 'bun' | 'yarn';
/**
 * The package manager that owns `projectRoot`, from the project's own
 * `packageManager` field, lockfile, or node_modules install files. A project
 * with none of those is a workspace member only if the nearest directory above
 * it that has them is a workspace root listing it; any other enclosing project
 * belongs to someone else, and its package manager is not this one's.
 */
export declare function detectPackageManager(projectRoot: string): Promise<{
    manager: null;
    reason: string;
    source?: never;
} | {
    manager: PackageManagerName;
    source: string;
    reason?: never;
}>;
export declare function isPackageManagerName(value: string): value is PackageManagerName;
/**
 * Whether the workspace globs declared at `rootDir` (package.json `workspaces`
 * for npm, Yarn, and bun; `pnpm-workspace.yaml` for pnpm) include `memberDir`.
 */
export declare function isWorkspaceMember(rootDir: string, memberDir: string): Promise<boolean>;
/**
 * The `packages` list of a pnpm-workspace.yaml, in block (`- 'apps/*'`) or
 * flow (`packages: ['apps/*']`) form. The SDK has no YAML parser, and the
 * file's other keys are irrelevant here.
 */
export declare function parsePnpmWorkspacePackages(yaml: string): string[];
/**
 * Why `manager` cannot install in `cwd`, or null when it can. The supported
 * set matches the installers the split addons document: npm 7+, pnpm, bun,
 * and Yarn Berry.
 */
export declare function checkPackageManagerSupport(manager: PackageManagerName, cwd: string): Promise<string | null>;
/** Arguments that add `specs` as exact-version dependencies of the package in cwd. */
export declare function installArgs(manager: PackageManagerName, specs: string[]): string[];
export interface RunPackageManagerResult {
    code: number | null;
    stdout: string;
    stderr: string;
    error?: Error;
}
/**
 * Quiet runs capture stdout and stderr; other runs stream them to this
 * process. Windows resolves the package managers' `.cmd` shims through the
 * shell, which does not escape arguments, so callers must pass only
 * validated ones.
 */
export declare function runPackageManager(manager: PackageManagerName, args: string[], options: {
    cwd: string;
    quiet: boolean;
}): Promise<RunPackageManagerResult>;
//# sourceMappingURL=package-manager.d.ts.map