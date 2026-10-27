import b4a from 'b4a';
import { errorMessage, isRecord } from './guards.js';
function stringField(value) {
    return typeof value === 'string' ? value : undefined;
}
function isRunVersion(value) {
    return (typeof value === 'string' &&
        value.length <= 40 &&
        /^\d{1,10}(?:\.\d{1,10}){0,3}(?:-[A-Za-z0-9.-]{1,16})?$/.test(value));
}
function objectField(value) {
    return isRecord(value) ? value : {};
}
export function isPlainWireValue(value) {
    if (value === null)
        return true;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return true;
    }
    return (Array.isArray(value) &&
        value.every((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'));
}
function isResource(value) {
    return isRecord(value) && typeof value.kind === 'string' && typeof value.label === 'string';
}
const REDACTED_RECOVERY_KEYS = new Set(['forkAt', 'forkSafe', 'recoveryOperationIds']);
export function redactedRecoveryFields(source) {
    const fields = {};
    for (const [key, value] of Object.entries(source)) {
        if (!REDACTED_RECOVERY_KEYS.has(key))
            continue;
        if (isPlainWireValue(value)) {
            fields[key] = value;
        }
    }
    return fields;
}
export function toWire(event) {
    const wire = toWirePayload(event);
    if (typeof event.runId === 'string') {
        wire.runId = event.runId;
    }
    if (typeof event.round === 'number') {
        wire.round = event.round;
    }
    if (typeof event.callId === 'string') {
        wire.callId = event.callId;
    }
    return wire;
}
function toWirePayload(event) {
    switch (event.type) {
        case 'run-started':
            return typeof event.parentRunId === 'string'
                ? { type: event.type, payload: { parentRunId: event.parentRunId } }
                : { type: event.type };
        case 'run-resumed':
        case 'paused':
            return { type: event.type };
        case 'round-reset': {
            const wire = { type: event.type };
            if (Array.isArray(event.replacedTypes)) {
                wire.replacedTypes = event.replacedTypes.filter((value) => typeof value === 'string');
            }
            return wire;
        }
        case 'recovery-required':
            return { type: event.type, payload: event.operation };
        case 'content':
        case 'thinking':
            return { type: event.type, text: event.text };
        case 'tool-call':
            return {
                type: 'tool-call',
                name: stringField(event.name),
                arguments: event.args,
                rawCall: stringField(event.rawCall) ?? null,
                effect: stringField(event.effect) ?? null,
                display: event.display
            };
        case 'tool-result':
            return {
                type: 'tool-result',
                name: stringField(event.name),
                result: event.result
            };
        case 'tool-activity':
            return {
                type: 'tool-activity',
                name: stringField(event.name),
                arguments: event.args,
                resource: isResource(event.resource) ? event.resource : null,
                effect: stringField(event.effect),
                decision: stringField(event.decision)
            };
        case 'metrics': {
            const { type, runId, ...metrics } = event;
            return { type, metrics };
        }
        case 'inference-call':
            return { type: 'inference-call', payload: event.call };
        case 'inference-sent':
            return {
                type: 'inference-sent',
                payload: {
                    round: event.round,
                    droppedTurns: event.droppedTurns,
                    tokens: event.tokens,
                    outcome: event.outcome,
                    reason: event.reason
                }
            };
        case 'error': {
            const diagnostic = {};
            if (event.code === 'PENDING_ARGS_REDACTED') {
                diagnostic.code = event.code;
                Object.assign(diagnostic, redactedRecoveryFields(event));
            }
            if (event.name === 'RunIncompatible' &&
                (event.kind === 'machine' || event.kind === 'log' || event.kind === 'xstate') &&
                isRunVersion(event.found) &&
                isRunVersion(event.expected)) {
                diagnostic.kind = event.kind;
                diagnostic.found = event.found;
                diagnostic.expected = event.expected;
            }
            const wire = { type: 'error', message: event.message };
            if (typeof event.name === 'string') {
                wire.name = event.name;
            }
            if (Object.keys(diagnostic).length > 0) {
                wire.payload = diagnostic;
            }
            return wire;
        }
        case 'aborted':
            return { type: 'aborted' };
        case 'input':
            return { type: 'input', text: stringField(event.text), callId: stringField(event.id) };
        case 'input-rejected':
            return { type: 'input-rejected', text: stringField(event.reason) };
        case 'context':
            return { type: 'context', callId: stringField(event.id), payload: event.context };
        case 'goal':
            return {
                type: 'goal',
                text: stringField(event.text),
                payload: { status: event.status, turn: event.turn, checks: event.checks }
            };
        case 'fold':
            return event.phase === 'done'
                ? {
                    type: 'fold',
                    payload: {
                        phase: 'done',
                        summary: event.summary,
                        throughId: event.throughId,
                        foldedTurns: event.foldedTurns
                    }
                }
                : { type: 'fold', payload: { phase: 'start' } };
        default:
            return { type: 'error', message: `unmapped harness event: ${event.type}` };
    }
}
export function fromWire(event) {
    const decoded = fromWirePayload(event);
    if (event.runId) {
        decoded.runId = event.runId;
    }
    if (event.runId &&
        event.round !== null &&
        event.round !== undefined &&
        [
            'content',
            'thinking',
            'tool-call',
            'tool-result',
            'tool-activity',
            'round-reset',
            'input',
            'context',
            'goal'
        ].includes(event.type)) {
        decoded.round = event.round;
    }
    if (event.callId) {
        decoded.callId = event.callId;
    }
    return decoded;
}
function fromWirePayload(event) {
    switch (event.type) {
        case 'run-started': {
            const { parentRunId } = Object(event.payload);
            return typeof parentRunId === 'string'
                ? { type: event.type, parentRunId }
                : { type: event.type };
        }
        case 'run-resumed':
        case 'paused':
            return { type: event.type };
        case 'round-reset':
            return {
                type: event.type,
                replacedTypes: event.replacedTypes ?? undefined
            };
        case 'recovery-required':
            return { type: event.type, operation: event.payload };
        case 'content':
        case 'thinking':
            return { type: event.type, text: event.text ?? '' };
        case 'tool-call':
            return {
                type: 'tool-call',
                name: event.name ?? '',
                args: event.arguments ?? {},
                rawCall: event.rawCall ?? undefined,
                effect: event.effect === 'read' ? 'read' : 'write',
                display: event.display ?? undefined
            };
        case 'tool-result':
            return {
                type: 'tool-result',
                name: event.name ?? '',
                result: event.result
            };
        case 'tool-activity':
            return {
                type: 'tool-activity',
                name: event.name ?? '',
                args: event.arguments ?? {},
                resource: event.resource ?? null,
                effect: event.effect === 'read' ? 'read' : 'write',
                decision: event.decision || 'blocked'
            };
        case 'metrics':
            return { type: 'metrics', ...objectField(event.metrics) };
        case 'inference-call':
            return { type: 'inference-call', call: event.payload };
        case 'inference-sent': {
            const sent = objectField(event.payload);
            return {
                type: 'inference-sent',
                round: Number(sent.round ?? 0),
                droppedTurns: Number(sent.droppedTurns ?? 0),
                tokens: sent.tokens,
                outcome: sent.outcome || 'completed',
                reason: sent.reason || undefined
            };
        }
        case 'error': {
            const diagnostic = objectField(event.payload);
            const decoded = {
                type: 'error',
                message: event.message ?? 'harness error'
            };
            if (event.name) {
                decoded.name = event.name;
            }
            if (diagnostic.code === 'PENDING_ARGS_REDACTED') {
                decoded.code = diagnostic.code;
                Object.assign(decoded, redactedRecoveryFields(diagnostic));
            }
            if (event.name === 'RunIncompatible' &&
                (diagnostic.kind === 'machine' ||
                    diagnostic.kind === 'log' ||
                    diagnostic.kind === 'xstate') &&
                isRunVersion(diagnostic.found) &&
                isRunVersion(diagnostic.expected)) {
                decoded.kind = diagnostic.kind;
                decoded.found = diagnostic.found;
                decoded.expected = diagnostic.expected;
            }
            return decoded;
        }
        case 'aborted':
            return { type: 'aborted' };
        case 'input':
            return { type: 'input', text: event.text ?? '', id: event.callId || undefined };
        case 'input-rejected':
            return { type: 'input-rejected', reason: event.text ?? '' };
        case 'context':
            return { type: 'context', id: event.callId || undefined, context: objectField(event.payload) };
        case 'goal': {
            const { status, turn, checks } = objectField(event.payload);
            return { type: 'goal', status, turn, text: event.text || undefined, checks };
        }
        case 'fold': {
            const { phase, summary, throughId, foldedTurns } = objectField(event.payload);
            return phase === 'done'
                ? { type: 'fold', phase, summary, throughId, foldedTurns }
                : { type: 'fold', phase: 'start' };
        }
        default:
            return { type: event.type };
    }
}
export function roundFailureWire(err) {
    const { name = 'Error', code } = isRecord(err) ? err : {};
    return {
        message: errorMessage(err),
        payload: {
            name: String(name),
            code: typeof code === 'string' || typeof code === 'number' ? code : undefined
        }
    };
}
export function roundFailureFrom(wire) {
    const { name, code } = objectField(wire.payload);
    return Object.assign(new Error(wire.message ?? 'model round failed'), {
        name: typeof name === 'string' ? name : 'Error',
        code
    });
}
function isRoundRequest(value) {
    return (isRecord(value) &&
        typeof value.runId === 'string' &&
        typeof value.round === 'number' &&
        typeof value.modelId === 'string' &&
        Array.isArray(value.history));
}
export function roundRequestFrom(payload) {
    if (!isRoundRequest(payload)) {
        throw new TypeError('invalid model round request');
    }
    return payload;
}
function isRoundResult(value) {
    return isRecord(value) && typeof value.contentText === 'string' && isRecord(value.final);
}
export function roundResultFrom(wire) {
    if (isRoundResult(wire.result)) {
        return wire.result;
    }
    throw roundFailureFrom(wire);
}
export function roundChunkFrom(payload) {
    const { type, text } = objectField(payload);
    return { type: type === 'thinking' ? 'thinking' : 'content', text: String(text ?? '') };
}
export function toDownloadWire(event) {
    switch (event.type) {
        case 'progress': {
            const { type, ...progress } = event;
            return { type, progress };
        }
        case 'complete':
            return {
                type: 'complete',
                assetId: stringField(event.assetId),
                downloaded: typeof event.downloaded === 'boolean' ? event.downloaded : undefined
            };
        case 'error':
            return { type: 'error', message: event.message };
        case 'aborted':
            return { type: 'aborted' };
        default:
            return { type: 'error', message: `unmapped download event: ${event.type}` };
    }
}
export function fromDownloadWire(event) {
    switch (event.type) {
        case 'progress':
            return { type: 'progress', ...objectField(event.progress) };
        case 'complete':
            return { type: 'complete', assetId: event.assetId ?? '', downloaded: event.downloaded };
        case 'error':
            return { type: 'error', message: event.message ?? 'download error' };
        case 'aborted':
            return { type: 'aborted' };
        default:
            return { type: event.type };
    }
}
export function packVectors(vectors) {
    const dimensions = vectors[0]?.length ?? 0;
    const bytes = b4a.alloc(vectors.length * dimensions * 4);
    let offset = 0;
    for (const vector of vectors) {
        if (vector.length !== dimensions) {
            throw new Error('embed returned ragged vectors — every row must share one dimension');
        }
        for (const value of vector) {
            b4a.writeFloatLE(bytes, value, offset);
            offset += 4;
        }
    }
    return { dimensions, vectors: bytes };
}
export function unpackVectors(dimensions, bytes) {
    if (dimensions === 0)
        return [];
    const rowBytes = dimensions * 4;
    if (bytes.byteLength % rowBytes !== 0) {
        throw new Error('embed response length does not match its dimensions');
    }
    const rows = [];
    for (let offset = 0; offset < bytes.byteLength; offset += rowBytes) {
        const row = [];
        for (let index = 0; index < dimensions; index++) {
            row.push(b4a.readFloatLE(bytes, offset + index * 4));
        }
        rows.push(row);
    }
    return rows;
}
function embeddingWire(embedding) {
    return embedding ? { model: embedding.model, ...packVectors(embedding.vectors) } : {};
}
function embeddingFrom(wire, rows) {
    if (!wire.model)
        return null;
    const dimensions = wire.dimensions ?? 0;
    const vectors = unpackVectors(dimensions, wire.vectors ?? b4a.alloc(0));
    if (vectors.length !== rows) {
        throw new Error(`knowledge carried ${vectors.length} vectors for ${rows} chunks`);
    }
    return { model: wire.model, dimensions, vectors };
}
function metadataOf(value) {
    return isRecord(value) ? value : undefined;
}
export function toKnowledgeUpsertWire(artifact) {
    return {
        artifactId: artifact.artifactId,
        version: artifact.version,
        scope: artifact.scope,
        chunks: artifact.chunks.map(({ id, text, metadata }) => ({ id, text, metadata })),
        ...embeddingWire(artifact.embedding)
    };
}
export function fromKnowledgeUpsertWire(wire) {
    const chunks = wire.chunks.map(({ id, text, metadata }) => ({
        id,
        text,
        metadata: metadataOf(metadata)
    }));
    return {
        artifactId: wire.artifactId,
        version: wire.version || undefined,
        scope: wire.scope,
        chunks,
        embedding: embeddingFrom(wire, chunks.length) ?? undefined
    };
}
export function toKnowledgeUpsertResultWire(result) {
    return { added: result.added, ...embeddingWire(result.embedded) };
}
export function fromKnowledgeUpsertResultWire(wire, chunks) {
    return { added: wire.added, embedded: embeddingFrom(wire, chunks) };
}
export function fromKnowledgeHitWire({ metadata, ...hit }) {
    return { ...hit, metadata: metadataOf(metadata) };
}
export function fromKnowledgeStatusWire(wire) {
    return {
        ...wire,
        artifacts: wire.artifacts.map((artifact) => ({
            ...artifact,
            version: artifact.version || undefined
        }))
    };
}
