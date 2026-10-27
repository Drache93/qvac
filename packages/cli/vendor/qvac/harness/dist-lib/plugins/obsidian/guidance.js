export const OBSIDIAN_NO_SHELL_FALLBACK = 'Do not use `ls`, `cat`, `find`, `grep`, or filesystem paths to inspect the vault ' +
    'or Obsidian config — that bypasses Obsidian and is wrong.';
export const OBSIDIAN_CLI_FAILURE_GUIDANCE = `${OBSIDIAN_NO_SHELL_FALLBACK} Correct the obsidian command or ask the user to open Obsidian / register the CLI.`;
export const OBSIDIAN_DESKTOP_AGENT_REQUIRED = 'Obsidian cannot run on this device. Switch the chat to the desktop agent that ' +
    'has Obsidian connected (Skills → Obsidian on that desktop), then ask again. ' +
    `${OBSIDIAN_NO_SHELL_FALLBACK} Do not retry the same command here.`;
export const OBSIDIAN_VAULT_SETUP_REQUIRED = 'Obsidian vault file mode is not set up. Under Snap/Flatpak the Obsidian CLI ' +
    'cannot reach the desktop app, so this skill needs a vault folder: ask the user ' +
    'to open Skills > Obsidian > Select vault folder, then retry the same `obsidian` ' +
    `command. ${OBSIDIAN_NO_SHELL_FALLBACK} This is a one-time setup step, not a reason ` +
    'to switch tools.';
