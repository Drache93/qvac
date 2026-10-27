import { errorMessage, isRecord } from '../guards.js';
import { HTML_HEAD, HTML_RECORDS_END, HTML_TAIL, RecordLines, activeStatePaths, contextValue, escapeHtml, htmlRunStart, recordLog, stateValue, verificationLine } from './inspect.js';
import { applyEngineStep, captureEngineStep, createEngineBoot } from './protocol.js';
import { RunLogFold } from './run-journal.js';
class Feed {
    items = [];
    closed = false;
    waiting = [];
    push(item) {
        if (this.closed)
            return;
        this.items.push(item);
        this.wake();
    }
    close() {
        this.closed = true;
        this.wake();
    }
    async *read() {
        let next = 0;
        while (next < this.items.length || !this.closed) {
            if (next === this.items.length) {
                await new Promise((resolve) => this.waiting.push(resolve));
                continue;
            }
            const ready = this.items.slice(next);
            next += ready.length;
            yield* ready;
        }
    }
    wake() {
        for (const resolve of this.waiting.splice(0)) {
            resolve();
        }
    }
}
class WatchedRun {
    boot = createEngineBoot();
    fold = new RunLogFold({ anyMachine: true });
    lines = new RecordLines();
    records = [];
    view;
    graph;
    written = false;
    constructor(runId) {
        this.view = {
            runId,
            seq: -1,
            index: -1,
            state: undefined,
            trace: [],
            lines: [],
            approval: null,
            pendingCall: null,
            currentCall: null,
            toolQueue: [],
            outcome: null
        };
    }
}
export class RunLogWatch {
    viewFeed = new Feed();
    htmlFeed = new Feed();
    runs = new Map();
    open;
    graphs = 0;
    started = false;
    ended = false;
    pending = Promise.resolve();
    step(step) {
        this.feed('', step);
    }
    views() {
        return this.viewFeed.read();
    }
    html() {
        return this.htmlFeed.read();
    }
    host(inner) {
        return {
            begin: (runId) => inner.begin(runId),
            append: async (runId, generation, step) => {
                await inner.append(runId, generation, step);
                this.feed(runId, step);
            },
            release: (runId, generation) => inner.release(runId, generation)
        };
    }
    async end() {
        if (!this.ended) {
            this.ended = true;
            this.viewFeed.close();
            if (this.open) {
                this.close(this.open);
            }
            if (this.started) {
                this.write(HTML_TAIL);
            }
        }
        await this.pending;
        this.htmlFeed.close();
    }
    feed(key, step) {
        if (this.ended)
            return;
        let run = this.runs.get(key);
        if (!run) {
            run = new WatchedRun(key);
            this.runs.set(key, run);
        }
        try {
            const captured = captureEngineStep(step);
            run.boot = applyEngineStep(run.boot, captured);
            for (const record of captured.records) {
                this.record(run, captured.seq, record);
            }
        }
        catch (error) {
            const message = errorMessage(error);
            this.show(run, { ...run.view, lines: [`step rejected: ${message}`], error: message });
        }
    }
    record(run, seq, input) {
        const entry = run.fold.add(input);
        const { record, snapshot } = entry;
        run.records.push(record);
        const context = contextValue(snapshot);
        const recorded = (isRecord(context) ? context : {});
        const previous = run.view.state;
        this.show(run, {
            runId: run.fold.boot.metadata?.runId ?? run.view.runId,
            seq,
            index: entry.index,
            state: stateValue(snapshot),
            trace: record.type === 'checkpoint' || record.type === 'delta' ? (record.trace ?? []) : [],
            lines: run.lines.render(entry),
            approval: recorded.approval ?? null,
            pendingCall: recorded.pendingCall ?? null,
            currentCall: recorded.currentCall ?? null,
            toolQueue: recorded.toolQueue ?? [],
            outcome: recorded.outcome ?? null
        });
        if (run.graph !== undefined && JSON.stringify(previous) !== JSON.stringify(run.view.state)) {
            this.write(highlight(run.graph, run.fold.boot.metadata?.definition, run.view.state));
        }
    }
    show(run, view) {
        run.view = view;
        this.viewFeed.push(view);
        if (this.open !== run) {
            this.start(run);
        }
        for (const line of view.lines) {
            this.write(`${run.written ? '\n' : ''}${escapeHtml(line)}`);
            run.written = true;
        }
    }
    start(run) {
        if (!this.started) {
            this.started = true;
            this.write(HTML_HEAD);
        }
        if (this.open) {
            this.close(this.open);
        }
        this.open = run;
        run.written = false;
        const definition = run.fold.boot.metadata?.definition;
        run.graph = isRecord(definition) ? ++this.graphs : undefined;
        this.write(htmlRunStart(definition));
    }
    close(run) {
        const separator = run.written ? '\n' : '';
        const metadata = run.fold.boot.metadata;
        const line = verificationLine(recordLog(run.records), metadata?.machine, metadata?.xstate);
        this.write(line.then((text) => `${separator}${escapeHtml(text)}${HTML_RECORDS_END}`));
    }
    write(chunk) {
        this.pending = this.pending
            .then(() => chunk)
            .then((text) => this.htmlFeed.push(text), (error) => this.htmlFeed.push(escapeHtml(errorMessage(error))));
    }
}
function cssString(value) {
    return value.replace(/[^\w.-]/gu, (char) => `\\${char.codePointAt(0)?.toString(16)} `);
}
function highlight(graph, definition, state) {
    const scope = `body>svg:nth-of-type(${graph})`;
    const active = activeStatePaths(definition, state)
        .map((path) => `${scope} [data-state="${cssString(path)}"] rect`)
        .join(',');
    return (`<style>${scope} [data-state] rect{fill:#fff;stroke:#435168}` +
        (active ? `${active}{fill:#fdeec4;stroke:#b7791f}` : '') +
        '</style>');
}
