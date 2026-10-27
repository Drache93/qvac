import { Lifecycle } from '../../lifecycle/index.js';
import { HookPipeline } from '../../hooks/index.js';
import { RunLog } from '../../run-log/index.js';
import { outboundGuard } from '../../tools/outbound-guard.js';
import { defaultAgentPorts } from '../agent-ports.js';
import { driveCompletion } from './driver.js';
import { WRAP_UP_PREDICT } from './actors/wrap-up.js';
import { ModelRound } from './model-round.js';
export class CompletionEngine {
    static WRAP_UP_PREDICT = WRAP_UP_PREDICT;
    static serveModelRound = ModelRound.serve;
    runtime;
    hooks;
    outbound;
    agentPorts;
    options;
    constructor(sdk, opts = {}) {
        this.runtime = typeof sdk === 'function' ? sdk : async () => ({ sdk });
        this.hooks = opts.hooks ?? HookPipeline.defaults();
        this.outbound = opts.outbound ?? outboundGuard;
        this.agentPorts = opts.agentPorts ?? defaultAgentPorts;
        this.options = opts;
    }
    run(args) {
        const redactor = RunLog.createRedactor();
        redactor.registerTools(args.tools ?? []);
        const loadRuntime = async (request) => {
            const loaded = await this.runtime(request);
            redactor.registerTools(loaded.args?.tools ?? args.tools ?? []);
            return loaded;
        };
        return Lifecycle.trackCompletion((signal) => driveCompletion({ ...args, signal }, loadRuntime, {
            ...this.options,
            pipeline: new HookPipeline(this.hooks),
            outbound: this.outbound,
            agentPorts: this.agentPorts,
            redact: redactor,
            redactShared: redactor.redactShared,
            redactOperationResult: redactor.redactOperationResult,
            redactRecord: redactor.redactRecord
        }), args.signal, () => { }).iterator;
    }
    static run(sdk, args, opts = {}) {
        return new CompletionEngine(sdk, opts).run(args);
    }
}
export { ToolSets } from './tool-sets.js';
