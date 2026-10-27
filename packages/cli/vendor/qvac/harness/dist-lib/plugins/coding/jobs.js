import { capped, errorText, guidance } from './session.js';
const MAX_JOBS = 4;
export class Jobs {
    _session;
    _jobs;
    _next;
    constructor(session) {
        this._session = session;
        this._jobs = new Map();
        this._next = 0;
    }
    _ofRun(runId) {
        return [...this._jobs.values()].filter((job) => job.runId === runId);
    }
    async start(call) {
        const { workspace, runId, line: command } = call;
        const running = this._ofRun(runId).filter((job) => job.status === 'running');
        if (running.length >= MAX_JOBS) {
            return guidance(`this run already has ${MAX_JOBS} running jobs; stop one with shell_jobs first`);
        }
        const id = `job-${++this._next}`;
        const handle = await this._session.start(call, id);
        const job = { id, runId, command, handle, workspace, status: 'running' };
        this._jobs.set(id, job);
        void handle.exited.then((code) => {
            if (job.status === 'running') {
                job.status = 'exited';
                job.exitCode = code;
            }
        });
        return { job: id, status: 'running', note: 'read it with shell_jobs action=output' };
    }
    async _stop(jobs) {
        const live = jobs.filter((job) => job.status === 'running');
        for (const job of live) {
            job.status = 'stopped';
        }
        await Promise.allSettled(live.map((job) => job.handle.stop()));
    }
    _find(runId, id) {
        const job = typeof id === 'string' ? this._jobs.get(id) : undefined;
        return job && job.runId === runId ? job : guidance(`no job ${String(id)} in this run`);
    }
    list(runId) {
        const jobs = this._ofRun(runId);
        return {
            jobs: jobs.map(({ id, command, status, exitCode }) => ({ id, command, status, exitCode }))
        };
    }
    async output(read, ctx) {
        const { since } = read;
        const job = this._find(read.runId, read.id);
        if ('error' in job) {
            return job;
        }
        const log = this._session.jobLog(job.id);
        const { stdout } = await this._session.execState(job.workspace, `n=$(wc -c < ${log} | tr -d ' '); echo "$n"; tail -c +${since + 1} ${log} | head -c $((n > ${since} ? n - ${since} : 0))`);
        const cut = stdout.indexOf('\n');
        const size = Number.parseInt(stdout.slice(0, cut), 10);
        return {
            output: await capped(stdout.slice(cut + 1), 'stdout', ctx),
            next: Number.isSafeInteger(size) ? Math.max(size, since) : since,
            status: job.status,
            exitCode: job.exitCode
        };
    }
    async stop(runId, id) {
        const job = this._find(runId, id);
        if ('error' in job) {
            return job;
        }
        await this._stop([job]);
        return { job: job.id, status: job.status };
    }
    async endRun(runId) {
        const jobs = this._ofRun(runId);
        await this._stop(jobs);
        for (const job of jobs) {
            this._jobs.delete(job.id);
        }
    }
    async close() {
        await this._stop([...this._jobs.values()]);
        this._jobs.clear();
    }
}
const ACTIONS = ['list', 'output', 'stop'];
const JOBS_PARAMETERS = {
    type: 'object',
    properties: {
        action: { type: 'string', enum: ACTIONS },
        id: { type: 'string', description: 'The job id shell returned' },
        since: { type: 'integer', description: 'Log offset to read from; default 0' }
    },
    required: ['action']
};
function invalid(args) {
    if (!ACTIONS.some((action) => action === args.action)) {
        return `action must be one of ${ACTIONS.join(', ')}`;
    }
    if (args.action !== 'list' && typeof args.id !== 'string') {
        return `${String(args.action)} needs the job id`;
    }
    const { since } = args;
    return since === undefined || (Number.isSafeInteger(since) && Number(since) >= 0)
        ? null
        : 'since must be a non-negative integer';
}
function runJobs(jobs, args, ctx) {
    const runId = ctx?.runId ?? '';
    if (args.action === 'list') {
        return Promise.resolve(jobs.list(runId));
    }
    if (args.action === 'stop') {
        return jobs.stop(runId, args.id);
    }
    const since = Number.isSafeInteger(args.since) ? Number(args.since) : 0;
    return jobs.output({ runId, id: args.id, since }, ctx);
}
export function shellJobsTool(session, jobs) {
    return {
        name: 'shell_jobs',
        toolset: 'coding',
        policyVersion: session.policyVersion(),
        description: 'List, read or stop the jobs shell started with background. output returns the log ' +
            'from the since offset and the offset to ask from next time. Jobs stop when the run ends.',
        parameters: JOBS_PARAMETERS,
        effect: (_args, ctx) => session.effect(ctx),
        quote: (args) => [args.action, args.id].filter((part) => typeof part === 'string').join(' '),
        validate: invalid,
        async execute(args, ctx) {
            const refused = session.refusal(ctx);
            if (refused) {
                return refused;
            }
            try {
                return await runJobs(jobs, args, ctx);
            }
            catch (error) {
                return { error: errorText(error) };
            }
        }
    };
}
