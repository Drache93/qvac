import { PluginRegistry } from '../../lib/plugins/index.js';
import { Jobs, shellJobsTool } from './jobs.js';
import { CodingSession, shellTool } from './session.js';
export class CodingPlugin {
    static TOOLS = ['shell', 'shell_jobs'];
    name = 'coding';
    api = PluginRegistry.API_VERSION;
    needs = ['sandbox'];
    read;
    deniedRoots;
    constructor({ read, deniedRoots } = {}) {
        this.read = read;
        this.deniedRoots = deniedRoots;
    }
    setup(ctx) {
        const deniedRoots = [...new Set([...ctx.deniedRoots, ...(this.deniedRoots ?? [])])];
        const session = new CodingSession(ctx.service('sandbox'), deniedRoots);
        const jobs = new Jobs(session);
        return {
            tools: [
                shellTool({ session, start: (call) => jobs.start(call) }),
                shellJobsTool(session, jobs)
            ],
            hooks: [
                {
                    name: 'stop-jobs',
                    phase: 'runEnd',
                    async run(hook) {
                        await jobs.endRun(hook.runId);
                        await session.endRun(hook.runId);
                    }
                }
            ],
            async teardown() {
                await jobs.close();
                await session.close();
            }
        };
    }
}
