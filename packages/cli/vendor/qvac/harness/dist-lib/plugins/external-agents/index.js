import { PluginRegistry } from '../../lib/plugins/index.js';
import { claudeCli, codexCli } from './cli.js';
import { acpDriver, agentTarget } from './targets.js';
const LOGINS = ['isolated', 'user'];
const PROTOCOLS = {
    acp: { argv: () => [], drive: acpDriver },
    claude: claudeCli,
    codex: codexCli
};
export class ExternalAgents {
    static PRESETS = {
        'claude-agent-acp': {
            protocol: 'acp',
            command: 'claude-agent-acp',
            keyEnv: 'ANTHROPIC_API_KEY',
            description: 'Claude Code, a coding agent that reads and edits the project'
        },
        'codex-acp': {
            protocol: 'acp',
            command: 'codex-acp',
            keyEnv: 'CODEX_API_KEY',
            description: 'Codex, a coding agent that reads and edits the project'
        }
    };
    static targets({ dir, targets }) {
        return targets.map((config) => agentTarget(config, dir, PROTOCOLS[config.protocol]));
    }
    name = 'external-agents';
    api = PluginRegistry.API_VERSION;
    provides = ['delegateTargets'];
    _options;
    constructor(options) {
        this._options = options;
    }
    validate() {
        const config = this._options;
        if (!config?.dir || !Array.isArray(config.targets)) {
            return 'needs a dir and a list of targets';
        }
        const names = config.targets.map((target) => target.name);
        if (new Set(names).size !== names.length || names.includes('local')) {
            return 'target names must be unique and not "local"';
        }
        if (!config.targets.every((target) => target.protocol in PROTOCOLS && target.command)) {
            return `each target needs a protocol (${Object.keys(PROTOCOLS).join(', ')}) and a command`;
        }
        return config.targets.every((target) => LOGINS.includes(target.login ?? 'isolated'))
            ? null
            : `a target's login must be ${LOGINS.join(' or ')}`;
    }
    setup() {
        return { services: { delegateTargets: ExternalAgents.targets(this._options) } };
    }
}
