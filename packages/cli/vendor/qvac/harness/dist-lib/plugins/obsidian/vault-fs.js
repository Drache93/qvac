import { HarnessError } from '../../lib/errors.js';
import { handleCreate } from './vault-create.js';
import { todayStamp } from './vault-paths.js';
import { handleDailyRead, handleFiles, handleFolders, handleOutline, handleProperties, handleRead, handleSearch, handleTags, handleVault, handleVaults, handleWordcount } from './vault-read.js';
import { handleAppend, handleDailyAppend, handleDelete, handleMove, handlePrepend, handlePropertySet, handleRename } from './vault-write.js';
export { parseObsidianCommand, normalizeObsidianCommand } from './command.js';
export { ensureWithinRoot } from './vault-paths.js';
export function executeVaultFsAction(vaultPath, action, args) {
    switch (action) {
        case 'vault':
            return handleVault(vaultPath);
        case 'vaults':
            return handleVaults(vaultPath);
        case 'read':
            return handleRead(vaultPath, args);
        case 'create':
            return handleCreate(vaultPath, args);
        case 'append':
            return handleAppend(vaultPath, args);
        case 'prepend':
            return handlePrepend(vaultPath, args);
        case 'delete':
            return handleDelete(vaultPath, args);
        case 'move':
            return handleMove(vaultPath, args);
        case 'rename':
            return handleRename(vaultPath, args);
        case 'files':
        case 'file':
            return handleFiles(vaultPath, args);
        case 'folders':
        case 'folder':
            return handleFolders(vaultPath);
        case 'search':
        case 'search:context':
            return handleSearch(vaultPath, args);
        case 'properties':
        case 'property:read':
            return handleProperties(vaultPath, args);
        case 'property:set':
            return handlePropertySet(vaultPath, args);
        case 'tags':
            return handleTags(vaultPath);
        case 'wordcount':
            return handleWordcount(vaultPath, args);
        case 'outline':
            return handleOutline(vaultPath, args);
        case 'daily:read':
            return handleDailyRead(vaultPath);
        case 'daily:append':
            return handleDailyAppend(vaultPath, args);
        case 'daily:path':
            return `Daily Notes/${todayStamp()}.md`;
        default:
            throw new HarnessError('OBSIDIAN_ACTION_UNSUPPORTED', [action]);
    }
}
