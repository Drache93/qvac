import { harnessClient } from '../../spec/calls.js';
import HRPC from '../../spec/hrpc/index.js';
import { encode } from '../../spec/hrpc/messages.js';
import { errorMessage, isRecord } from '../guards.js';
import { addonTaskType } from '../models/model-task.js';
import { pushQueue } from '../queue.js';
import { settleOnClose } from '../rpc-session.js';
import { fromDownloadWire, fromWire } from '../wire.js';
const NO_ATTACHMENTS = 'this client carries no attachments';
export class HarnessClient {
    _transport;
    _opening = null;
    _closed = false;
    constructor(transport) {
        this._transport = transport;
    }
    async *completion(context) {
        const { client } = await this._open();
        const signal = context.signal;
        if (signal?.aborted) {
            yield { type: 'aborted' };
            return;
        }
        const duplex = client.completion();
        let runId;
        let failure = null;
        let closed = false;
        let done = false;
        let emittedAborted = false;
        const send = (frame) => {
            if (closed)
                return;
            try {
                encode('@harness/completion-frame', frame);
            }
            catch (err) {
                failure ??= new Error(`cannot encode ${String(frame.type)} frame: ${errorMessage(err)}`);
                duplex.destroy(failure);
                return;
            }
            duplex.write(frame);
        };
        const onAbort = () => duplex.destroy();
        signal?.addEventListener?.('abort', onAbort, { once: true });
        try {
            send({
                type: 'start',
                payload: { recoveryEvents: true },
                model: context.model,
                agent: context.agent,
                cacheKey: context.cacheKey,
                thinkingDefault: context.thinkingDefault,
                toolConfigs: context.toolConfigs,
                generationParams: context.generationParams,
                responseFormat: context.responseFormat,
                maxToolRounds: context.maxToolRounds || undefined,
                messages: context.messages
            });
            if (failure) {
                throw failure;
            }
            for await (const event of frames(duplex)) {
                if (event.type === 'done') {
                    done = true;
                    break;
                }
                if (answered(event, context, send)) {
                    continue;
                }
                const wire = fromWire(event);
                if (wire.type === 'run-started' || wire.type === 'run-resumed') {
                    runId = event.runId ?? runId;
                }
                if (wire.type === 'aborted' || wire.type === 'paused') {
                    emittedAborted = true;
                }
                yield wire;
            }
        }
        catch (err) {
            if (failure) {
                throw failure;
            }
            if (!signal?.aborted) {
                throw new Error(`harness died mid-run: ${errorMessage(err)}`);
            }
        }
        finally {
            closed = true;
            signal?.removeEventListener?.('abort', onAbort);
            duplex.destroy();
        }
        if (signal?.aborted) {
            if (!emittedAborted) {
                yield { type: 'aborted', runId };
            }
            return;
        }
        if (!done) {
            throw new Error('harness closed mid-run');
        }
    }
    async *download(context) {
        const { client } = await this._open();
        const signal = context.signal;
        if (signal?.aborted) {
            yield { type: 'aborted' };
            return;
        }
        const stream = client.download({
            model: context.model,
            addon: context.addon,
            seed: context.seed
        });
        let emittedAborted = false;
        const onAbort = () => stream.destroy();
        signal?.addEventListener?.('abort', onAbort, { once: true });
        try {
            for await (const event of frames(stream)) {
                const wire = fromDownloadWire(event);
                if (wire.type === 'aborted') {
                    emittedAborted = true;
                }
                yield wire;
            }
        }
        catch (err) {
            if (!signal?.aborted) {
                throw new Error(`harness died mid-download: ${errorMessage(err)}`);
            }
        }
        finally {
            signal?.removeEventListener?.('abort', onAbort);
            stream.destroy();
        }
        if (signal?.aborted && !emittedAborted) {
            yield { type: 'aborted' };
        }
    }
    async list(options = {}) {
        const { client } = await this._open();
        const response = await client.listModels({
            type: options.type,
            cachedOnly: options.cachedOnly,
            fullRegistry: options.fullRegistry
        });
        return (response.models ?? []).map(({ actualSize, label, fit, fitBasis, fitEvidence, ...row }) => ({
            ...row,
            actualSize: actualSize || undefined,
            label: label || undefined,
            taskType: addonTaskType(row.type),
            fit: (fit || undefined),
            fitBasis: (fitBasis || undefined),
            fitEvidence: (fitEvidence || undefined)
        }));
    }
    close() {
        this._closed = true;
        void this._opening?.then((session) => session.stream.destroy(), () => { });
    }
    _open() {
        if (this._closed) {
            return Promise.reject(new Error('harness client closed'));
        }
        this._opening ??= this._connect();
        return this._opening.then((session) => {
            if (session.dead)
                throw new Error('harness connection closed');
            return session;
        });
    }
    async _connect() {
        const stream = await this._transport();
        const session = {
            client: harnessClient(settleOnClose(new HRPC(stream))),
            stream,
            dead: false
        };
        stream.on('close', () => {
            session.dead = true;
        });
        if (this._closed) {
            stream.destroy();
        }
        return session;
    }
}
async function* frames(stream) {
    const queue = pushQueue();
    let error = null;
    stream.on('data', (frame) => queue.push(frame));
    stream.on('end', () => queue.end());
    stream.on('close', () => queue.end());
    stream.on('error', (err) => {
        error = err;
        queue.end();
    });
    yield* queue;
    if (error) {
        throw error;
    }
}
function answered(event, context, send) {
    const callId = event.callId;
    switch (event.type) {
        case 'approval-ask':
            void Promise.resolve()
                .then(() => context.approve?.(approvalCall(event)))
                .then((approved) => approved === true, () => false)
                .then((approved) => send({ type: 'decision', callId, approved }));
            return true;
        case 'question-ask':
            answerQuestion(event, context.askUser, send);
            return true;
        case 'attach-ask':
            send({ type: 'attach-result', callId, message: NO_ATTACHMENTS });
            return true;
        case 'fetch-ask':
            send({ type: 'fetch-result', callId, message: NO_ATTACHMENTS });
            return true;
        case 'progress':
            context.progress?.(event.cleared ? null : { percentage: event.percentage ?? 0 });
            return true;
        default:
            return false;
    }
}
function answerQuestion(event, askUser, send) {
    const callId = event.callId;
    if (!askUser) {
        send({ type: 'question-result', callId, message: 'the host cannot ask questions' });
        return;
    }
    void Promise.resolve()
        .then(() => askUser({
        question: event.question ?? '',
        options: Array.isArray(event.options) ? event.options.map(String) : undefined
    }))
        .then((answer) => send({ type: 'question-result', callId, answer: answer ?? '' }), (err) => send({ type: 'question-result', callId, message: errorMessage(err) }));
}
function approvalCall(event) {
    const identity = isRecord(event.payload) ? event.payload : {};
    const approval = {
        name: event.name ?? '',
        arguments: isRecord(event.arguments) ? event.arguments : {},
        resource: event.resource ?? null,
        effect: event.effect === 'read' ? 'read' : 'write',
        intent: event.intent || null,
        display: isToolCallDisplay(event.display) ? event.display : null,
        quote: event.question || null
    };
    if (typeof identity.callId === 'string') {
        approval.callId = identity.callId;
    }
    if (typeof identity.round === 'number') {
        approval.round = identity.round;
    }
    return approval;
}
function isToolCallDisplay(value) {
    return isRecord(value) && typeof value.label === 'string';
}
