export { parseObsidianCommand, normalizeObsidianCommand } from './command.ts';
export { ensureWithinRoot } from './vault-paths.ts';
export declare function executeVaultFsAction(vaultPath: string, action: string, args: string[]): string;
