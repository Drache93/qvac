import fs from 'fs';
import { homedir } from 'os';
import path from 'path';
import process from 'process';
export const OBSIDIAN_SKILL_NAME = 'obsidian';
export const OBSIDIAN_VAULT_PATH_CREDENTIAL_KEY = 'obsidian_vault_path';
export const OBSIDIAN_VAULT_MODE_NOTE = [
    'Runtime note — Obsidian vault file mode is active (a vault folder is configured):',
    '- Run vault commands through the `exec` tool, e.g. `obsidian files`, `obsidian search query="..."`, `obsidian read path="Folder/Note.md"`.',
    '- To list what is in the vault, run `obsidian files`. `read` takes a note name or a path inside the vault, never the vault folder.',
    '- `obsidian vaults` returns only the configured vault folder, not every vault in the Obsidian app.',
    '- App-only actions (open in app, plugin/sync/theme commands) are unavailable in this mode; they require the official Obsidian CLI connected to the running app.'
].join('\n');
export const OBSIDIAN_BIN_CANDIDATES = {
    darwin: [
        '/Applications/Obsidian.app/Contents/MacOS/obsidian',
        '~/Applications/Obsidian.app/Contents/MacOS/obsidian',
        '/usr/local/bin/obsidian'
    ],
    linux: [
        '/usr/bin/obsidian',
        '/usr/local/bin/obsidian',
        '~/.local/bin/obsidian',
        '/opt/Obsidian/obsidian',
        '/snap/bin/obsidian'
    ],
    win32: [
        '%LOCALAPPDATA%\\Programs\\Obsidian\\Obsidian.exe',
        '%LOCALAPPDATA%\\Obsidian\\Obsidian.exe',
        '%ProgramFiles%\\Obsidian\\Obsidian.exe',
        '%ProgramFiles(x86)%\\Obsidian\\Obsidian.exe'
    ]
};
export const OBSIDIAN_CONFIG_CANDIDATES = {
    darwin: ['~/Library/Application Support/obsidian/obsidian.json'],
    linux: [
        '~/.config/obsidian/obsidian.json',
        '~/snap/obsidian/current/.config/obsidian/obsidian.json',
        '~/.var/app/md.obsidian.Obsidian/config/obsidian/obsidian.json'
    ],
    win32: ['%APPDATA%\\obsidian\\obsidian.json']
};
function environment() {
    return process.env;
}
export function expandObsidianPath(candidate, env = environment(), home = homedir()) {
    const withHome = candidate.startsWith('~/') ? path.join(home, candidate.slice(2)) : candidate;
    return withHome.replace(/\$([A-Za-z_][A-Za-z0-9_]*)|%([^%]+)%/g, (_match, unix, windows) => env[unix ?? windows ?? ''] ?? '');
}
export function firstExistingPath(candidates, expand, exists) {
    for (const candidate of candidates) {
        const expanded = expand(candidate);
        if (expanded && exists(expanded)) {
            return expanded;
        }
    }
    return null;
}
export function obsidianInstallState(platform, probe = {}) {
    const expand = probe.expand ?? ((candidate) => expandObsidianPath(candidate));
    const exists = probe.exists ?? ((candidate) => fs.existsSync(candidate));
    const installed = firstExistingPath(OBSIDIAN_BIN_CANDIDATES[platform ?? ''] ?? [], expand, exists);
    return installed ? 'installed' : 'missing';
}
export function parseObsidianCliEnabled(text) {
    try {
        const value = JSON.parse(text);
        if (typeof value !== 'object' || value === null || !('cli' in value)) {
            return null;
        }
        return typeof value.cli === 'boolean' ? value.cli : null;
    }
    catch {
        return null;
    }
}
export function obsidianCliState(platform, probe = {}) {
    const expand = probe.expand ?? ((candidate) => expandObsidianPath(candidate));
    const exists = probe.exists ?? ((candidate) => fs.existsSync(candidate));
    const readText = probe.readText ?? ((candidate) => fs.readFileSync(candidate, 'utf8'));
    const config = firstExistingPath(OBSIDIAN_CONFIG_CANDIDATES[platform ?? ''] ?? [], expand, exists);
    if (!config) {
        return 'unknown';
    }
    try {
        const enabled = parseObsidianCliEnabled(readText(config));
        if (enabled === null) {
            return 'unknown';
        }
        return enabled ? 'enabled' : 'disabled';
    }
    catch {
        return 'unknown';
    }
}
export function isSandboxedWorkbenchInstall(env = environment()) {
    return Boolean(env.SNAP || env.FLATPAK_ID);
}
export function isObsidianVaultPath(value, existsDir = (candidate) => {
    try {
        return fs.statSync(candidate).isDirectory();
    }
    catch {
        return false;
    }
}) {
    if (!value)
        return false;
    return existsDir(path.join(value, '.obsidian'));
}
