import { randomBytes } from 'crypto';
import { RunLog } from '../../lib/run-log/index.js';
import { chain } from './chain.js';
import { flow } from './flow.js';
import { layout } from './layout.js';
import { reportModel } from './model.js';
import { PluginRegistry } from '../../lib/plugins/index.js';
import { parts, shell } from './page.js';
PluginRegistry.requirePeers('run-report', {
    elkjs: () => import.meta.resolve('elkjs/lib/elk.bundled.js')
});
export class RunReport {
    static record() {
        const hops = [];
        const requestDigestKey = randomBytes(32);
        const hopLog = () => {
            const records = [];
            let boot = RunLog.createEngineBoot();
            hops.push(records);
            const onStep = (step) => {
                boot = RunLog.applyEngineStep(boot, step);
                records.push(...step.records.map((record) => JSON.parse(JSON.stringify(record))));
                return Promise.resolve();
            };
            return { boot, onStep, requestDigestKey };
        };
        return { hops, options: { hopLog } };
    }
    static async render(source, options = {}) {
        return shell(await RunReport.parts(source, options));
    }
    static async parts(source, { title, live = false } = {}) {
        const sources = 'hops' in source ? source.hops : [source];
        const models = await Promise.all(sources.map((run) => reportModel(Array.isArray(run) ? RunLog.fromRecords([...run]) : run, live)));
        const model = chain(models);
        const machine = model.definition
            ? { run: await layout(model.definition, model), all: await layout(model.definition) }
            : null;
        const views = { flow: flow(model), machine };
        const named = models.map(({ run }) => `${run.agent} on ${run.model}`).join(' → ');
        return parts(model, views, title ?? named);
    }
    static live({ source = '' } = {}) {
        return shell(null, { live: { source } });
    }
}
