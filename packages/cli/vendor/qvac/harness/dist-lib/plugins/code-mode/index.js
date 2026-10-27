import { PluginRegistry } from '../../lib/plugins/index.js';
export const RUN_CODE_TOOL_NAME = 'run_code';
const DESCRIPTION = 'Run JavaScript, the body of an async function. Call the other tools whose schemas you have ' +
    'as `await tools.<name>({ ...args })`; each call is checked and approved as if you made it, ' +
    'and a denied or failed call returns `{ error }`. `return` the answer; `console.log` lines ' +
    'come back as logs. There is no network, file system or clock.';
export class CodeMode {
    name = 'code-mode';
    api = PluginRegistry.API_VERSION;
    read;
    tool;
    constructor({ quickjs, read }) {
        this.read = read;
        this.tool = {
            name: RUN_CODE_TOOL_NAME,
            description: DESCRIPTION,
            parameters: {
                type: 'object',
                properties: { code: { type: 'string', description: 'The function body' } },
                required: ['code']
            },
            toolset: 'exec',
            callsTools: true,
            minCapabilityProfile: 'mid',
            effect: () => 'read',
            validate: (args) => typeof args.code === 'string' && args.code.trim() ? null : 'code must be a script',
            execute: async (args, ctx) => {
                const callTool = ctx?.callTool;
                if (!callTool) {
                    throw new Error('run_code runs only inside a completion');
                }
                const tools = Object.fromEntries(callTool.names.map((name) => [name, (input) => callTool(name, input)]));
                const ran = await quickjs.run(String(args.code), { bindings: { tools } });
                return 'error' in ran
                    ? { error: ran.error, logs: ran.logs }
                    : { result: ran.value ?? null, logs: ran.logs };
            }
        };
    }
    setup() {
        return { tools: [this.tool] };
    }
}
