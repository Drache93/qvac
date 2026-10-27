import process from 'process';
import { errorMessage, isRecord } from '../../lib/guards.js';
import { PluginRegistry } from '../../lib/plugins/index.js';
import { SKILL_STATE } from '../../lib/tools/skills/skill-state-constants.js';
import { isObsidianVaultPath, isSandboxedWorkbenchInstall, OBSIDIAN_SKILL_NAME, OBSIDIAN_VAULT_MODE_NOTE, OBSIDIAN_VAULT_PATH_CREDENTIAL_KEY, obsidianCliState, obsidianInstallState } from './readiness.js';
import { capOutput, MAX_OUTPUT_CHARS } from '../../lib/tools/exec/runner.js';
import { runObsidianCli } from './cli.js';
import { normalizeObsidianCommand, parseObsidianCommand } from './command.js';
import { OBSIDIAN_DESKTOP_AGENT_REQUIRED, OBSIDIAN_NO_SHELL_FALLBACK, OBSIDIAN_VAULT_SETUP_REQUIRED } from './guidance.js';
import { executeVaultFsAction } from './vault-fs.js';
const DESKTOP_PLATFORMS = new Set(['darwin', 'linux', 'win32']);
function credentialRecord(value) {
    if (typeof value === 'string') {
        return value ? { token: value } : null;
    }
    return value?.token ? value : null;
}
function limitResult(result, maxOutputChars) {
    return {
        stdout: capOutput(result.stdout, maxOutputChars),
        stderr: capOutput(result.stderr, maxOutputChars),
        exitCode: result.exitCode
    };
}
function vaultFsResult(stdout, exitCode) {
    return exitCode === 0
        ? { stdout, stderr: '', exitCode: 0 }
        : { stdout: '', stderr: `${stdout}\n\n${OBSIDIAN_NO_SHELL_FALLBACK}`, exitCode };
}
function runVaultFs(vaultPath, { action, args, maxOutputChars }) {
    try {
        return limitResult(vaultFsResult(executeVaultFsAction(vaultPath, action, args), 0), maxOutputChars);
    }
    catch (error) {
        const message = errorMessage(error);
        return limitResult(vaultFsResult(message, 1), maxOutputChars);
    }
}
async function resolveVaultPath(credentialStore, ctx) {
    if (!credentialStore)
        return null;
    const record = credentialRecord(await credentialStore(OBSIDIAN_VAULT_PATH_CREDENTIAL_KEY, ctx));
    const token = record?.token?.trim();
    if (!token || !isObsidianVaultPath(token)) {
        return null;
    }
    return token;
}
async function skillState({ platform, agentId, credentialStore, missingBins }, { env = process.env, probe }) {
    if (await resolveVaultPath(credentialStore, { agentId, skills: [OBSIDIAN_SKILL_NAME] })) {
        return SKILL_STATE.ready;
    }
    if (isSandboxedWorkbenchInstall(env)) {
        return SKILL_STATE.needsSetup;
    }
    const cli = obsidianCliState(platform, probe);
    if (cli === 'enabled' &&
        missingBins.length === 1 &&
        missingBins[0] === 'obsidian' &&
        obsidianInstallState(platform, probe) === 'installed') {
        return SKILL_STATE.ready;
    }
    if (missingBins.length === 0 && cli === 'disabled') {
        return SKILL_STATE.needsSetup;
    }
    return null;
}
function vaultNoteHook(credentialStore) {
    return {
        name: 'vault-mode-note',
        phase: 'postToolCall',
        async run(ctx) {
            if (ctx.phase !== 'postToolCall' || ctx.toolName !== 'skill')
                return;
            const { result } = ctx;
            if (!isRecord(result) ||
                result.name !== OBSIDIAN_SKILL_NAME ||
                typeof result.content !== 'string') {
                return;
            }
            const ask = { agentId: ctx.agentId, skills: [OBSIDIAN_SKILL_NAME] };
            if (!(await resolveVaultPath(credentialStore, ask))) {
                return;
            }
            return { result: { ...result, content: `${result.content}\n\n${OBSIDIAN_VAULT_MODE_NOTE}` } };
        }
    };
}
export class ObsidianRoute {
    name = 'obsidian';
    api = PluginRegistry.API_VERSION;
    _options;
    constructor(options = {}) {
        this._options = options;
    }
    setup() {
        const options = this._options;
        const readiness = {
            skill: OBSIDIAN_SKILL_NAME,
            state: (ctx) => skillState(ctx, options),
            probeVersions: false,
            deviceSharedKeys: [OBSIDIAN_VAULT_PATH_CREDENTIAL_KEY]
        };
        return {
            exec: { routes: [this] },
            skills: [readiness],
            hooks: [vaultNoteHook(options.credentialStore)]
        };
    }
    claims(command) {
        return parseObsidianCommand(command) !== null;
    }
    async run(command, ctx, { timeoutMs, maxOutputChars = MAX_OUTPUT_CHARS, signal, runtime }) {
        const parsed = parseObsidianCommand(command);
        if (!parsed) {
            return { stdout: '', stderr: 'Not an obsidian command.', exitCode: 1 };
        }
        if (signal?.aborted) {
            return { stdout: '', stderr: 'Obsidian command aborted.', exitCode: 1 };
        }
        const platform = this._options.platform ?? process.platform;
        if (!DESKTOP_PLATFORMS.has(platform)) {
            return { stdout: '', stderr: OBSIDIAN_DESKTOP_AGENT_REQUIRED, exitCode: 1 };
        }
        const vaultPath = await resolveVaultPath(this._options.credentialStore, ctx);
        if (vaultPath) {
            return runVaultFs(vaultPath, { action: parsed.action, args: parsed.args, maxOutputChars });
        }
        if (isSandboxedWorkbenchInstall(this._options.env ?? process.env)) {
            return { stdout: '', stderr: OBSIDIAN_VAULT_SETUP_REQUIRED, exitCode: 1 };
        }
        return runObsidianCli(normalizeObsidianCommand(command), await runtime(), {
            timeoutMs,
            maxOutputChars,
            signal
        });
    }
}
