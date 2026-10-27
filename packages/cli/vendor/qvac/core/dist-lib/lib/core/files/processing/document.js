import {} from '../rag/index.js';
import { IndexingClaims } from './claims.js';
import { ArtifactOwnership } from './ownership.js';
import { listIndexingByKnowledge, resolveIndexing } from './protocol.js';
import { fileRecord } from '../records/index.js';
import b4a from 'b4a';
export class FileDocument {
    _mesh;
    record;
    state;
    source;
    claims;
    ownership;
    schedule;
    closed;
    paused;
    admit;
    _output;
    _fetched = false;
    _progress;
    _processor;
    constructor(mesh, options) {
        const { record } = options;
        this._mesh = mesh;
        this.record = record;
        this._processor = options.processor;
        const state = mesh.files.processorState(options.processor.id);
        this.state = state.document(record.id);
        this.source = this._fetching(fileSource(options.source, { id: record.id, reference: record.blobId }));
        this._output = options.output;
        this.schedule = options.schedule;
        this.closed = () => options.closed() || !!mesh.closing;
        this.paused = options.paused;
        this.admit = options.admit ?? (() => { });
        this._progress = options.progress;
        const claims = new IndexingClaims({
            mesh,
            ...options,
            state,
            advisory: record.kind === 'attachment'
        });
        this.claims = {
            markFailed: (id) => claims.markFailed(id),
            isFailed: (id) => claims.isFailed(id),
            blockedByStatus: (id) => claims.blockedByStatus(id),
            claim: (id) => claims.claim(id, record.id),
            lease: (id, claimId) => claims.lease(id, claimId),
            settle: (id) => claims.settle(id, record.id)
        };
        this.ownership = new ArtifactOwnership(mesh, state);
    }
    get log() {
        return this._mesh.log;
    }
    get localCoreKey() {
        return b4a.toHex(this._mesh.blobs.core.key);
    }
    artifact(id) {
        return this._mesh.files.processorState(this._processor.id).artifact(id);
    }
    readArtifact(id) {
        return this._mesh.files.state.readArtifact(id);
    }
    output(id, reference) {
        this.artifact(id).knowledgeId = this.record.id;
        return this._fetching(fileSource(this._output, { id, reference }));
    }
    async clearFetched() {
        if (this._fetched) {
            await this._mesh.files.clearFetched(this.record.blobId, this.record.id);
        }
    }
    _fetching(source) {
        return {
            ...source,
            read: async (signal) => {
                const read = await source.read(signal);
                if (read.kind === 'bytes') {
                    this._fetched = true;
                }
                return read;
            }
        };
    }
    artifacts() {
        return this._mesh.files.artifacts(this.record.id);
    }
    statuses() {
        return listIndexingByKnowledge(this._mesh, { knowledgeId: this.record.id });
    }
    current() {
        return fileRecord(this._mesh.view, this.record.id, this._processor.input);
    }
    publish(input) {
        return this._mesh.files.publish({ ...input, knowledgeId: this.record.id });
    }
    resolve(input) {
        return resolveIndexing(this._mesh, input);
    }
    async write(bytes) {
        const { blobRef, reference } = await this._mesh.files.put(bytes);
        return { blobRef, artifactBlobId: reference };
    }
    inline(bytes, mimeType) {
        return this._mesh.files.inline(bytes, mimeType);
    }
    work(state) {
        this._mesh.files.work(this.record.id, state, this._processor.id);
    }
    load(state, artifactId) {
        this._mesh.files.load(this.record.id, state, { artifactId, processorId: this._processor.id });
    }
    report(update) {
        const progress = { ...update, knowledgeId: this.record.id, chatId: this.record.chatId };
        this._mesh.files.report(progress, this._processor.id);
        this._progress?.(progress);
    }
}
function fileSource(source, { id, reference }) {
    return {
        read: (signal) => source.read(id, reference, signal),
        blockedUntil: () => source.retryBlockedUntil(id, Date.now()),
        miss: () => source.retryMiss(id, Date.now()),
        clear: () => source.retryClear(id)
    };
}
