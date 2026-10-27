import { CompletionMachine } from '../machine/index.js';
import { replayRun, ReplayDivergence, ReplayTraceDivergence } from './replay.js';
import { RUN_LOG_VERSION, XSTATE_VERSION, readRunLog } from './run-journal.js';
import { requestMessages } from './history-codec.js';
import { RequestDecoder } from './request-codec.js';
import { errorMessage, isRecord } from '../guards.js';
function isPositionedInspectionCore(core) {
    return 'records' in core && typeof core.records === 'function';
}
async function inspectionLog(core) {
    if (!isPositionedInspectionCore(core)) {
        await core.ready();
        return { log: core };
    }
    const envelope = core;
    const counter = (name) => {
        const value = envelope[name];
        if (value === undefined) {
            return undefined;
        }
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
            throw new TypeError(`Run export ${name} must be a non-negative integer`);
        }
        return value;
    };
    const exportPhysicalLength = counter('physicalLength');
    const exportLogicalLength = counter('logicalLength');
    const exportNextSeq = counter('nextSeq');
    const values = [];
    const positions = new Map();
    let previousPosition;
    for await (const entry of envelope.records()) {
        if (entry.recordIndex !== values.length) {
            throw new TypeError(`Run export recordIndex ${entry.recordIndex} is not contiguous`);
        }
        if (!Number.isSafeInteger(entry.stepSeq) ||
            entry.stepSeq < 0 ||
            !Number.isSafeInteger(entry.physicalLength) ||
            entry.physicalLength < 0) {
            throw new TypeError(`Run export has invalid physical position at recordIndex ${entry.recordIndex}`);
        }
        const currentPosition = { stepSeq: entry.stepSeq, physicalLength: entry.physicalLength };
        if (exportPhysicalLength !== undefined && entry.physicalLength > exportPhysicalLength) {
            throw new TypeError(`Run export recordIndex ${entry.recordIndex} physicalLength ${entry.physicalLength} exceeds exported prefix ${exportPhysicalLength}`);
        }
        if (previousPosition) {
            if (entry.stepSeq < previousPosition.stepSeq) {
                throw new TypeError(`Run export stepSeq decreases at recordIndex ${entry.recordIndex}`);
            }
            if (entry.physicalLength < previousPosition.physicalLength) {
                throw new TypeError(`Run export physicalLength decreases at recordIndex ${entry.recordIndex}`);
            }
            if (entry.stepSeq === previousPosition.stepSeq &&
                entry.physicalLength !== previousPosition.physicalLength) {
                throw new TypeError(`Run export stepSeq ${entry.stepSeq} has inconsistent physicalLength boundaries`);
            }
            if (exportNextSeq !== undefined && entry.stepSeq > previousPosition.stepSeq + 1) {
                throw new TypeError(`Run export omits a committed step before stepSeq ${entry.stepSeq}`);
            }
        }
        else if (exportNextSeq !== undefined && entry.stepSeq !== 0) {
            throw new TypeError('Run export stepSeq must start at 0 when nextSeq is declared');
        }
        values.push(entry.record);
        positions.set(entry.recordIndex, currentPosition);
        previousPosition = currentPosition;
    }
    if (exportLogicalLength !== undefined && values.length !== exportLogicalLength) {
        throw new TypeError(`Run export logicalLength ${exportLogicalLength} does not match ${values.length} positioned records`);
    }
    if (exportNextSeq !== undefined) {
        const actualNextSeq = previousPosition ? previousPosition.stepSeq + 1 : 0;
        if (actualNextSeq !== exportNextSeq) {
            throw new TypeError(`Run export nextSeq ${exportNextSeq} does not match last positioned step boundary ${actualNextSeq}`);
        }
    }
    return { log: recordLog(values), positions, exportPhysicalLength };
}
export function recordLog(values) {
    return {
        get length() {
            return values.length;
        },
        async ready() { },
        async get(index) {
            return values[index] ?? null;
        },
        async append(value) {
            if (!isRunRecord(value)) {
                throw new TypeError('Run export append must be a current run record');
            }
            values.push(value);
        }
    };
}
const MAX_JSON = 300;
function json(value, limit = MAX_JSON) {
    const text = JSON.stringify(value) ?? 'undefined';
    return text.length > limit ? `${text.slice(0, limit)}…` : text;
}
export function stateValue(snapshot) {
    return isRecord(snapshot) ? snapshot.value : undefined;
}
export function contextValue(snapshot) {
    return isRecord(snapshot) ? snapshot.context : undefined;
}
function isRunRecord(value) {
    if (!isRecord(value) || value.version !== RUN_LOG_VERSION) {
        return false;
    }
    return (value.type === 'metadata' ||
        value.type === 'fork' ||
        value.type === 'checkpoint' ||
        value.type === 'delta' ||
        value.type === 'operation' ||
        value.type === 'request');
}
function changedValues({ patch, before, after, path = '', out = [] }) {
    if (!isRecord(patch))
        return out;
    if ('$' in patch) {
        out.push(`${path || '$'}: ${json(before)} -> ${json(after)}`);
    }
    else if ('t' in patch && typeof patch.t === 'number') {
        const beforeTail = Array.isArray(before) ? before.slice(patch.t) : [];
        let afterTail;
        if (Array.isArray(after)) {
            afterTail = after.slice(patch.t);
        }
        else if (Array.isArray(patch.a)) {
            afterTail = patch.a;
        }
        else {
            afterTail = [];
        }
        out.push(`${path || '$'}[${patch.t}..]: ${json(beforeTail)} -> ${json(afterTail)}`);
    }
    else if ('o' in patch && isRecord(patch.o)) {
        const beforeObject = isRecord(before) ? before : {};
        const afterObject = isRecord(after) ? after : {};
        for (const key of Array.isArray(patch.d) ? patch.d : []) {
            if (typeof key !== 'string')
                continue;
            out.push(`${path ? `${path}.` : ''}${key}: ${json(beforeObject[key])} -> <deleted>`);
        }
        for (const [key, entry] of Object.entries(patch.o)) {
            changedValues({
                patch: entry,
                before: beforeObject[key],
                after: afterObject[key],
                path: path ? `${path}.${key}` : key,
                out
            });
        }
    }
    return out;
}
function traceLine(trace) {
    const source = trace.sourceIds.length ? trace.sourceIds.join(', ') : '(start)';
    const target = trace.targetIds.length ? trace.targetIds.join(', ') : '(self)';
    const guards = trace.guardNames.length ? ` guard=${trace.guardNames.join(', ')}` : '';
    const actions = trace.actionNames.length ? ` actions=${trace.actionNames.join(', ')}` : '';
    const marker = trace.eventType === '' ? ' [eventless; not replay-verified]' : '';
    return `microstep ${trace.eventType} ${source} -> ${target}${guards}${actions}${marker}`;
}
function operationLine(index, record) {
    const receipt = record.receipt;
    const detail = receipt.status === 'result' ? ` result=${json(receipt.result)}` : ` args=${json(receipt.args)}`;
    return `recordIndex ${index} ${receipt.status} ${receipt.effect} ${receipt.name}${detail}`;
}
function metadataLines(index, record, opts) {
    const lines = [
        `recordIndex ${index} run ${record.runId} log v${record.version} machine v${record.machine} xstate ${record.xstate ?? '?'}`
    ];
    if (opts.position) {
        lines.push(positionLine(index, opts.position));
    }
    if (CompletionMachine.VERSION !== record.machine) {
        lines.push(`recordIndex ${index} machine drift: local v${CompletionMachine.VERSION}; recorded v${record.machine}; recorded definition and snapshots remain authoritative`);
    }
    if (XSTATE_VERSION !== record.xstate) {
        lines.push(`recordIndex ${index} XState drift: local ${XSTATE_VERSION}; recorded ${record.xstate ?? '?'}; recorded definition and snapshots remain authoritative`);
    }
    if (opts.expectedMachineVersion !== undefined &&
        opts.expectedMachineVersion !== CompletionMachine.VERSION) {
        lines.push(`recordIndex ${index} caller expected machine v${opts.expectedMachineVersion}; this inspector runs v${CompletionMachine.VERSION}`);
    }
    if (opts.expectedXstateVersion !== undefined && opts.expectedXstateVersion !== XSTATE_VERSION) {
        lines.push(`recordIndex ${index} caller expected XState ${opts.expectedXstateVersion}; this inspector runs ${XSTATE_VERSION}`);
    }
    if (opts.context) {
        lines.push(`recordIndex ${index} context undefined (no checkpoint yet)`);
    }
    return lines;
}
function positionLine(index, position) {
    return `recordIndex ${index} stepSeq ${position.stepSeq} physicalLength ${position.physicalLength}`;
}
export class RecordLines {
    previous;
    base;
    requests = new RequestDecoder();
    printedRequest = false;
    render(entry, opts = {}) {
        const { index, record, snapshot } = entry;
        if (record.type === 'metadata') {
            this.base = requestMessages(record.request);
            return metadataLines(index, record, opts);
        }
        const lines = opts.position ? [positionLine(index, opts.position)] : [];
        if (record.type === 'operation') {
            lines.push(operationLine(index, record));
        }
        else if (record.type === 'fork') {
            lines.push(`recordIndex ${index} fork ${record.runId} of ${record.forkedFrom.runId} at recordIndex ${record.forkedFrom.length}`);
        }
        else if (record.type === 'request') {
            lines.push(requestLine(index, record));
            const params = this.requests.decode(record, this.base);
            if (opts.requestRecord === index) {
                this.printedRequest = true;
                lines.push(`recordIndex ${index} request params ${JSON.stringify(params)}`);
            }
        }
        else {
            lines.push(...this.transitionLines(entry));
        }
        if (opts.context) {
            lines.push(`recordIndex ${index} context ${JSON.stringify(contextValue(snapshot)) ?? 'undefined'}`);
        }
        if (record.type !== 'operation' && record.type !== 'request') {
            this.previous = snapshot;
        }
        return lines;
    }
    transitionLines({ index, record, snapshot, events }) {
        if (record.type !== 'checkpoint' && record.type !== 'delta') {
            return [];
        }
        const previous = this.previous;
        const lines = [
            `recordIndex ${index} ${record.type} state ${json(stateValue(previous))} -> ${json(stateValue(snapshot))}`
        ];
        for (const trace of record.trace ?? []) {
            lines.push(`recordIndex ${index} ${traceLine(trace)}`);
        }
        if (!record.trace?.length && events.length) {
            lines.push(`recordIndex ${index} transition trace unavailable; decoded events are shown`);
        }
        for (const event of events) {
            lines.push(`recordIndex ${index} event ${json(event)}`);
        }
        if (record.type === 'delta' && record.patch) {
            const paths = changedValues({ patch: record.patch, before: previous, after: snapshot });
            if (paths.length) {
                lines.push(`recordIndex ${index} changed ${paths.join('; ')}`);
            }
        }
        return lines;
    }
}
function requestLine(index, record) {
    const messages = record.messages;
    const appended = '$qvacHistory' in messages ? messages.$qvacHistory.items.length : messages.length;
    const tools = record.tools
        ? ` tools ${record.tools.ref.slice(0, 12)}${record.tools.block ? ' inline' : ''}`
        : '';
    return `recordIndex ${index} request round ${record.round} attempt ${record.attempt} droppedTurns ${record.droppedTurns} keep ${record.keep} +${appended}${tools}`;
}
async function* readInspection(source, opts) {
    validateIndex('recordLimit', opts.recordLimit);
    validateIndex('contextRecord', opts.contextRecord);
    validateIndex('requestRecord', opts.requestRecord);
    validateIndex('physicalLength', opts.physicalLength);
    validateIndex('contextPhysicalLength', opts.contextPhysicalLength);
    if (opts.contextRecord !== undefined && opts.contextPhysicalLength !== undefined) {
        throw new TypeError('Choose contextRecord or contextPhysicalLength, not both');
    }
    if (opts.contextPhysicalLength !== undefined &&
        opts.physicalLength !== undefined &&
        opts.contextPhysicalLength > opts.physicalLength) {
        throw new RangeError(`contextPhysicalLength ${opts.contextPhysicalLength} is beyond physicalLength ${opts.physicalLength}`);
    }
    const { log: core, positions, exportPhysicalLength } = await inspectionLog(source);
    if (opts.contextRecord !== undefined) {
        if (opts.contextRecord >= core.length) {
            throw new RangeError(`contextRecord ${opts.contextRecord} is outside logical export length ${core.length}`);
        }
        if (opts.recordLimit !== undefined && opts.contextRecord >= opts.recordLimit) {
            throw new RangeError(`contextRecord ${opts.contextRecord} is excluded by recordLimit ${opts.recordLimit}`);
        }
        const position = positions?.get(opts.contextRecord);
        if (opts.physicalLength !== undefined &&
            position &&
            position.physicalLength > opts.physicalLength) {
            throw new RangeError(`contextRecord ${opts.contextRecord} is beyond physicalLength ${opts.physicalLength}`);
        }
    }
    const lines = new RecordLines();
    let recordedMachine;
    let recordedXstate;
    let physicalContextRecord;
    if (positions && exportPhysicalLength === undefined) {
        yield {
            line: 'export physicalLength envelope unavailable; physical positions are row metadata, not a validated export bound'
        };
    }
    if (opts.contextPhysicalLength !== undefined) {
        const selection = selectPhysicalContext(positions, opts.contextPhysicalLength, exportPhysicalLength);
        physicalContextRecord = selection.recordIndex;
        for (const line of selection.lines) {
            yield { line };
        }
    }
    const contextRecord = opts.contextPhysicalLength === undefined ? opts.contextRecord : physicalContextRecord;
    if (opts.contextPhysicalLength !== undefined && physicalContextRecord !== undefined) {
        if (opts.recordLimit !== undefined && physicalContextRecord >= opts.recordLimit) {
            throw new RangeError(`physical context recordIndex ${physicalContextRecord} is excluded by recordLimit ${opts.recordLimit}`);
        }
        const position = positions?.get(physicalContextRecord);
        if (opts.physicalLength !== undefined &&
            position &&
            position.physicalLength > opts.physicalLength) {
            throw new RangeError(`physical context recordIndex ${physicalContextRecord} is beyond physicalLength ${opts.physicalLength}`);
        }
    }
    if (opts.physicalLength !== undefined && !positions) {
        yield {
            line: `physicalLength selection unavailable: export has no physicalLength mapping for ${opts.physicalLength}`
        };
    }
    else if (opts.physicalLength !== undefined &&
        exportPhysicalLength !== undefined &&
        opts.physicalLength > exportPhysicalLength) {
        yield {
            line: `physicalLength selection unavailable: requested ${opts.physicalLength} exceeds exported prefix ${exportPhysicalLength}; showing the complete export`
        };
    }
    else if (opts.physicalLength !== undefined && exportPhysicalLength === undefined) {
        yield {
            line: `physicalLength ${opts.physicalLength} selection is not validated against an exported physicalLength envelope`
        };
    }
    else if (opts.physicalLength !== undefined &&
        opts.physicalLength !== exportPhysicalLength &&
        ![...(positions?.values() ?? [])].some((position) => position.physicalLength === opts.physicalLength)) {
        yield {
            line: `physicalLength ${opts.physicalLength} is not a represented step boundary; rows show the latest committed steps at or before it, not a validated physical prefix`
        };
    }
    for await (const item of readRunLog(core, { anyMachine: true })) {
        if (opts.recordLimit !== undefined && item.index >= opts.recordLimit)
            break;
        const itemPosition = positions?.get(item.index);
        if (opts.physicalLength !== undefined &&
            itemPosition &&
            itemPosition.physicalLength > opts.physicalLength) {
            break;
        }
        const { record } = item;
        if (record.type === 'metadata') {
            recordedMachine = record.machine;
            recordedXstate = record.xstate;
        }
        const rendered = lines.render(item, {
            position: positions?.get(item.index),
            context: contextRecord === item.index,
            requestRecord: opts.requestRecord,
            expectedMachineVersion: opts.expectedMachineVersion,
            expectedXstateVersion: opts.expectedXstateVersion
        });
        for (const [i, line] of rendered.entries()) {
            yield i === 0 && record.type === 'metadata'
                ? { line, definition: record.definition }
                : { line };
        }
    }
    if (opts.requestRecord !== undefined && !lines.printedRequest) {
        yield { line: `recordIndex ${opts.requestRecord} is not a request record in this selection` };
    }
    if (opts.recordLimit !== undefined || opts.physicalLength !== undefined) {
        yield {
            line: 'replay verification skipped: a recordIndex or physicalLength limit selected a prefix; recorded snapshots remain authoritative'
        };
    }
    else {
        yield { line: await verificationLine(core, recordedMachine, recordedXstate) };
    }
}
export async function verificationLine(core, machine, xstate) {
    if (machine === undefined || xstate === undefined) {
        return 'state/context replay unavailable: run metadata does not record both machine and XState versions';
    }
    if (machine !== CompletionMachine.VERSION || xstate !== XSTATE_VERSION) {
        return 'replay verification skipped: recorded machine or XState version differs from this implementation; stored snapshots and recorded transition traces remain authoritative';
    }
    return await replayVerificationLine(core);
}
function selectPhysicalContext(positions, requestedLength, exportPhysicalLength) {
    if (!positions) {
        return {
            lines: [
                `physical context unavailable: export has no physicalLength mapping for ${requestedLength}`
            ]
        };
    }
    if (exportPhysicalLength !== undefined && requestedLength > exportPhysicalLength) {
        return {
            lines: [
                `physical context unavailable: requested physicalLength ${requestedLength} exceeds exported prefix ${exportPhysicalLength}`
            ]
        };
    }
    const isExportBoundary = exportPhysicalLength === requestedLength;
    const exactStepBoundary = [...positions.values()].some((position) => position.physicalLength === requestedLength);
    if (!exactStepBoundary && !isExportBoundary) {
        const message = exportPhysicalLength === undefined
            ? `physical context unavailable: ${requestedLength} is not a represented step boundary and this export has no trusted physicalLength envelope`
            : `physical context unavailable: ${requestedLength} is neither a represented step boundary nor the exported prefix ${exportPhysicalLength}`;
        return { lines: [message] };
    }
    let recordIndex;
    for (const [index, position] of positions) {
        if (position.physicalLength > requestedLength)
            continue;
        if (recordIndex !== undefined && index <= recordIndex)
            continue;
        recordIndex = index;
    }
    if (recordIndex === undefined) {
        return { lines: [`no committed record at or before physicalLength ${requestedLength}`] };
    }
    const position = positions.get(recordIndex);
    if (!position) {
        throw new Error(`Missing physical position for recordIndex ${recordIndex}`);
    }
    const lines = [
        `physicalLength ${requestedLength} selects context after recordIndex ${recordIndex} stepSeq ${position.stepSeq} at physicalLength ${position.physicalLength}`
    ];
    if (isExportBoundary && position.physicalLength < requestedLength) {
        lines.push(`exported prefix ends at physicalLength ${requestedLength}; latest committed step ends at ${position.physicalLength}`);
    }
    return { recordIndex, lines };
}
async function replayVerificationLine(core) {
    try {
        let checked = 0;
        for await (const _step of replayRun(CompletionMachine.create(), core)) {
            checked++;
        }
        return `state/context replay and event-triggered guard/action traces matched for ${checked} recorded event${checked === 1 ? '' : 's'}; eventless guard/action traces are not replay-verified; stored snapshots remain authoritative`;
    }
    catch (error) {
        if (error instanceof ReplayTraceDivergence) {
            return `TRANSITION TRACE REPLAY DIVERGENCE at recordIndex ${error.index}: recorded ${JSON.stringify(error.expected)}; replayed ${JSON.stringify(error.actual)}; stored snapshots remain authoritative`;
        }
        if (error instanceof ReplayDivergence) {
            return `STATE/CONTEXT REPLAY DIVERGENCE at recordIndex ${error.index}: ${error.message}; recorded snapshots remain authoritative`;
        }
        return `state/context replay unavailable: ${errorMessage(error)}; recorded snapshots remain authoritative`;
    }
}
function validateIndex(name, value) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
        throw new TypeError(`${name} must be a non-negative integer`);
    }
}
export async function* inspectRun(core, opts = {}) {
    for await (const { line } of readInspection(core, opts)) {
        yield line;
    }
}
export function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
const MAX_GRAPH_NODES = 300;
const MAX_GRAPH_DEPTH = 32;
const GRAPH_LABEL_CHARS = 120;
function graphText(value) {
    const text = typeof value === 'string' ? value : String(value ?? '?');
    return text.length > GRAPH_LABEL_CHARS ? `${text.slice(0, GRAPH_LABEL_CHARS)}…` : text;
}
function transitionParts(event, transition) {
    const value = isRecord(transition) ? transition : {};
    const targets = Array.isArray(value.target) ? value.target.map(graphText) : [];
    const guard = value.guard === undefined ? '' : graphText(value.guard);
    const actions = Array.isArray(value.actions) ? value.actions.map(graphText) : [];
    return { event: graphText(event), targets, guard, actions };
}
function stateDefinition(value) {
    return isRecord(value) ? value : undefined;
}
function nodeLabel(node, fallbackId) {
    return typeof node.id === 'string' ? graphText(node.id) : graphText(fallbackId);
}
export function activeStatePaths(definition, value) {
    const root = stateDefinition(definition);
    if (!root) {
        return [];
    }
    const out = [];
    const walk = (node, path) => {
        if (typeof node === 'string') {
            out.push(`${path}.${node}`);
        }
        else if (isRecord(node)) {
            for (const [key, child] of Object.entries(node)) {
                out.push(`${path}.${key}`);
                walk(child, `${path}.${key}`);
            }
        }
    };
    walk(value, nodeLabel(root, 'root'));
    return out;
}
function renderTransitionPaths(node, context) {
    const paths = [];
    for (const item of node.events) {
        const transition = transitionParts(item.event, item.transition);
        for (const targetId of transition.targets) {
            const targetIndex = context.byStateId.get(targetId);
            if (targetIndex === undefined) {
                continue;
            }
            const target = context.nodes[targetIndex];
            if (!target) {
                continue;
            }
            const sx = context.x(node) + context.nodeWidth;
            const sy = context.y(node) + context.nodeHeight / 2;
            const tx = context.x(target);
            const ty = context.y(target) + context.nodeHeight / 2;
            const bend = Math.max(24, Math.abs(tx - sx) / 2);
            const label = `${transition.event}${transition.guard ? ` [${transition.guard}]` : ''}${transition.actions.length ? ` / ${transition.actions.join(', ')}` : ''}`;
            paths.push(`<path class="transition" marker-end="url(#arrow)" d="M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx} ${ty}"/>`);
            paths.push(`<text class="edge-label" x="${Math.round((sx + tx) / 2)}" y="${Math.round((sy + ty) / 2) - 4}">${escapeHtml(label)}</text>`);
        }
    }
    return paths;
}
function renderDefinition(definition) {
    const root = stateDefinition(definition);
    if (!root) {
        return '<p>No machine definition was recorded.</p>';
    }
    const nodes = [];
    const work = [{ node: root, fallbackId: 'root', depth: 0 }];
    while (work.length && nodes.length < MAX_GRAPH_NODES) {
        const entry = work.pop();
        if (!entry) {
            continue;
        }
        const index = nodes.length;
        const id = nodeLabel(entry.node, entry.fallbackId);
        const path = entry.path ?? id;
        const events = [];
        const transitions = isRecord(entry.node.on) ? entry.node.on : {};
        for (const [event, listed] of Object.entries(transitions)) {
            const choices = Array.isArray(listed) ? listed : [listed];
            for (const transition of choices) {
                events.push({ event, transition });
            }
        }
        for (const transition of Array.isArray(entry.node.always) ? entry.node.always : []) {
            events.push({ event: 'always', transition });
        }
        const invokes = Array.isArray(entry.node.invoke) ? entry.node.invoke : [];
        nodes.push({
            index,
            id,
            path,
            depth: entry.depth,
            parent: entry.parent,
            events,
            invokes: invokes.map((invoke) => graphText(isRecord(invoke) ? invoke.id : undefined))
        });
        if (entry.depth >= MAX_GRAPH_DEPTH) {
            continue;
        }
        const children = Object.entries(isRecord(entry.node.states) ? entry.node.states : {});
        for (let i = children.length - 1; i >= 0; i--) {
            const childEntry = children[i];
            if (!childEntry) {
                continue;
            }
            const [key, child] = childEntry;
            const childDefinition = stateDefinition(child);
            if (childDefinition) {
                work.push({
                    node: childDefinition,
                    fallbackId: key,
                    path: `${path}.${key}`,
                    depth: entry.depth + 1,
                    parent: index
                });
            }
        }
    }
    const byStateId = new Map(nodes.map((node) => [node.id, node.index]));
    const depthWidth = 210;
    const rowHeight = 76;
    const nodeWidth = 174;
    const nodeHeight = 40;
    const left = 28;
    const top = 28;
    const width = Math.max(260, left * 2 + depthWidth * Math.max(0, ...nodes.map((node) => node.depth)) + nodeWidth);
    const height = Math.max(120, top * 2 + rowHeight * nodes.length);
    const x = (node) => left + depthWidth * node.depth;
    const y = (node) => top + rowHeight * node.index;
    const parts = [
        `<svg class="machine-graph" role="img" aria-label="Recorded state machine graph" viewBox="0 0 ${width} ${height}" width="100%" height="${height}">`,
        '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#526071"/></marker></defs>'
    ];
    for (const node of nodes) {
        if (node.parent === undefined)
            continue;
        const parent = nodes[node.parent];
        if (!parent) {
            continue;
        }
        const px = x(parent) + nodeWidth / 2;
        const py = y(parent) + nodeHeight;
        const cx = x(node) + nodeWidth / 2;
        const cy = y(node);
        parts.push(`<path class="hierarchy" d="M ${px} ${py} L ${cx} ${cy}"/>`);
    }
    const geometry = { nodes, byStateId, x, y, nodeWidth, nodeHeight };
    for (const node of nodes) {
        parts.push(...renderTransitionPaths(node, geometry));
    }
    for (const node of nodes) {
        const nx = x(node);
        const ny = y(node);
        parts.push(`<g class="state" data-state="${escapeHtml(node.path)}"><rect x="${nx}" y="${ny}" width="${nodeWidth}" height="${nodeHeight}" rx="6"/><text x="${nx + 9}" y="${ny + 25}">${escapeHtml(node.id)}</text></g>`);
        for (const invoke of node.invokes) {
            parts.push(`<text class="invoke" x="${nx + 4}" y="${ny + nodeHeight + 17}">invoke ${escapeHtml(invoke)}</text>`);
        }
        for (const item of node.events) {
            const transition = transitionParts(item.event, item.transition);
            const unresolved = transition.targets.filter((target) => !byStateId.has(target));
            if (unresolved.length || !transition.targets.length) {
                const summary = `${transition.event} → ${unresolved.join(', ') || '(self)'}${transition.guard ? ` [${transition.guard}]` : ''}${transition.actions.length ? ` / ${transition.actions.join(', ')}` : ''}`;
                parts.push(`<text class="unresolved" x="${nx}" y="${ny + nodeHeight + 17}">${escapeHtml(summary)}</text>`);
            }
        }
    }
    parts.push('</svg>');
    if (work.length) {
        parts.push('<p>Graph truncated to a bounded set of recorded states.</p>');
    }
    return parts.join('');
}
export const HTML_HEAD = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
    '<title>Run log inspection</title><style>body{font:14px system-ui;margin:2rem;line-height:1.5}' +
    'pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f4f4;padding:1rem}' +
    'svg{max-height:75vh;background:#fafbfc;border:1px solid #d5dae0}svg .hierarchy{stroke:#a8b0bc;stroke-width:1.4}svg .transition{fill:none;stroke:#526071;stroke-width:1.5}svg .state rect{fill:#fff;stroke:#435168;stroke-width:1.5}svg text{font:12px system-ui;fill:#17212e}svg .edge-label{font-size:10px;fill:#39485c}svg .invoke,svg .unresolved{font-size:10px;fill:#536176}' +
    '</style></head><body>';
export const HTML_RECORDS_END = '</pre>';
export const HTML_TAIL = '</body></html>';
export function htmlRunStart(definition) {
    return ('<h1>Recorded machine definition</h1>' +
        renderDefinition(definition) +
        '<h1>Run records</h1><pre>');
}
export async function renderRunLogHtml(core, opts = {}) {
    let definition;
    const lines = [];
    for await (const item of readInspection(core, opts)) {
        lines.push(item.line);
        if (item.definition !== undefined) {
            definition = item.definition;
        }
    }
    return (HTML_HEAD +
        htmlRunStart(definition) +
        escapeHtml(lines.join('\n')) +
        HTML_RECORDS_END +
        HTML_TAIL);
}
