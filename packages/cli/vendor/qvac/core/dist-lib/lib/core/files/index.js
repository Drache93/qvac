import b4a from 'b4a';
import EventEmitter from 'bare-events';
import { attachmentFiles } from './attachments.js';
import { isKnowledgeRoutedAttachment, getKnowledge, listKnowledge, getKnowledgeArtifact, listKnowledgeArtifactsByKnowledge, addKnowledgeArtifact, hasLiveSource, syncAttachmentChunk, syncKnowledgeTombstone, syncArtifactArrival, sweepTombstonedBlobs, reclaimPurgedFiles, referencedBlobs, scopedFile, attachmentRecord, isProcessorOutput, isProcessorArtifactId, knowledgeCapBytes, usedKnowledgeBytes } from './records/index.js';
import { knowledgeFiles } from './knowledge.js';
import { randomId } from '../id.js';
import { findChunksOfType, getChunk, listChunks } from '../chunk.js';
import { settleFiles, isClaimLive, listIndexingByChat, listIndexingByKnowledge, FileState, FileProcessing } from './processing/index.js';
import { DeadlineScheduler } from '../../deadline.js';
import { liveDeviceForWriter } from '../contract/activity.js';
import { runDefinition } from '../shared-agents.js';
import { BlobStore, parseBlobReference } from './store/index.js';
import { AbortedError } from '@qvac/harness/race-abort';
import { RagProcessor } from './rag/index.js';
import { PreviewProcessor, PREVIEW_VERSION, previewId } from './preview/index.js';
import { parseFailure } from './rag/failure.js';
import { CoreError } from '../../errors.js';
import { errorMessage } from '../../guards.js';
import { ACTIVE_KNOWLEDGE_BASE, ACTIVE_KNOWLEDGE_BY_CHAT, AGENTS, CHATS, INDEXING_STATUS_BY_CHAT, INDEXING_STATUS_BY_KNOWLEDGE, KNOWLEDGE, KNOWLEDGE_ARTIFACTS_BY_KNOWLEDGE } from '../collections.js';
export { fullTextBudgetChars, fullTextHits, joinedIndex, retrieveRagKnowledge, searchRagChunks, referencesPendingFile } from './rag/index.js';
export { isKnowledgeRoutedAttachment } from './records/index.js';
export { assertRemovableAt } from './records/index.js';
export { assertArtifactOutput } from './records/index.js';
export { claimSource } from './records/index.js';
export class Files extends EventEmitter {
    _mesh;
    _uploads = new Map();
    state = new FileState();
    _states = new Map([['rag', this.state]]);
    _processors = new Map();
    _store;
    _deadline = new DeadlineScheduler(() => {
        this._pruneUploads();
        this._updated();
    });
    _updated = () => this.emit('update');
    _model = null;
    _paused = false;
    closed = false;
    constructor(mesh) {
        super();
        this._mesh = mesh;
        mesh.watch(this._updated);
        this._store = new BlobStore(mesh);
        this._store.on('update', this._updated);
    }
    async *read(reference, options = {}) {
        let recorded = false;
        for await (const frame of this._store.read(reference, options)) {
            if (!recorded) {
                this._mesh.fileIndex?.read(reference);
            }
            recorded = true;
            yield frame;
        }
    }
    async readBytes(reference, options = {}) {
        const bytes = await this._store.readBytes(reference, options);
        this._mesh.fileIndex?.read(reference);
        return bytes;
    }
    async download(reference, options) {
        await this._store.download(reference, options);
        this._mesh.fileIndex?.read(reference);
    }
    write(chunks, options = {}) {
        return this._store.write(chunks, options);
    }
    put(bytes) {
        return this._store.put(bytes);
    }
    inline(bytes, mimeType) {
        return this._store.inline(bytes, mimeType);
    }
    reference(id) {
        return this._store.reference(id);
    }
    clear(reference, id) {
        return this._store.clear(reference, id);
    }
    async clearFetched(reference, id) {
        const { coreKey, inline } = parseBlobReference(reference);
        if (inline || !coreKey || coreKey === b4a.toHex(this._mesh.blobs.core.key)) {
            return;
        }
        if (await this.clear(reference, id)) {
            await this._mesh.fileIndex?.markCleared(reference);
        }
    }
    compact(coreKeys) {
        return this._store.compact(coreKeys);
    }
    attachments(options = {}) {
        return attachmentFiles(this._mesh, options);
    }
    knowledge(options = {}) {
        return knowledgeFiles(this._mesh, options);
    }
    listKnowledge(chatId) {
        return listKnowledge(this._mesh, { chatId });
    }
    async knowledgeBase() {
        const snap = this._mesh.view.snapshot();
        try {
            const entries = [];
            const rows = await snap.find(ACTIVE_KNOWLEDGE_BASE).toArray();
            for (const knowledge of rows) {
                const attempts = await snap
                    .find(INDEXING_STATUS_BY_KNOWLEDGE, {
                    gte: { knowledgeId: knowledge.id },
                    lte: { knowledgeId: knowledge.id }
                })
                    .toArray();
                const rag = attempts.filter((row) => !isProcessorArtifactId(row.id));
                const latest = rag.reduce((current, row) => (!current || row.at > current.at ? row : current), null);
                const status = rag.find((row) => row.status === 'ready') ?? latest;
                const failed = status?.status === 'failed' ? status : null;
                const failure = failed && parseFailure(failed.error);
                const device = failed && (await liveDeviceForWriter(snap, failed.claimedBy));
                entries.push({
                    knowledge,
                    status: status?.status ?? 'indexing',
                    error: failure?.detail,
                    loaded: !!this.state.get(knowledge.id)?.loaded,
                    reason: failure?.reason,
                    failedOn: device?.name
                });
            }
            return {
                entries,
                usedBytes: usedKnowledgeBytes(rows),
                capBytes: await knowledgeCapBytes(snap)
            };
        }
        finally {
            await snap.close();
        }
    }
    record(id) {
        return getKnowledge(this._mesh, id);
    }
    async resolve(request) {
        const snap = this._mesh.view.snapshot();
        try {
            return await scopedFile(snap, request);
        }
        finally {
            await snap.close();
        }
    }
    async *fileRead(request, options = {}) {
        const file = await this.resolve(request);
        if (options.signal?.aborted) {
            throw new AbortedError();
        }
        if (!file) {
            return;
        }
        yield { metadata: file };
        if (!request.metadataOnly) {
            yield* this.read(file.blobId, options);
        }
    }
    async preview(request) {
        const file = await this.resolve(request);
        if (!file || !this._processors.get('preview')?.processor.applies(file)) {
            return {};
        }
        const output = await this.artifact(previewId(file));
        if (!output || output.embedderVersion !== PREVIEW_VERSION) {
            return {};
        }
        const reference = parseBlobReference(output.artifactBlobId);
        if (reference.inline?.mimeType !== 'image/jpeg') {
            throw new Error('invalid preview output');
        }
        return {
            outputId: output.id,
            mimeType: reference.inline.mimeType,
            data: await this.readBytes(output.artifactBlobId)
        };
    }
    async retry({ chatId, fileId, processorId }) {
        const file = chatId
            ? await this.resolve({ chatId, fileId })
            : await this._retryKnowledgeBase(fileId);
        const entry = this._processors.get(processorId);
        if (!file || !entry) {
            return;
        }
        this.processorState(processorId).retry(file.id);
        await entry.work.enqueue([file.id]);
        this._updated();
    }
    async _retryKnowledgeBase(fileId) {
        if (this._mesh.role !== 'project') {
            throw new CoreError('KNOWLEDGE_BASE_NOT_A_PROJECT');
        }
        const knowledge = await this.record(fileId);
        if (!knowledge || knowledge.chatId || knowledge.deletedAt) {
            throw new CoreError('KNOWLEDGE_NOT_FOUND', [fileId]);
        }
        const failedAt = (await listIndexingByKnowledge(this._mesh, { knowledgeId: fileId }))
            .filter((row) => row.status === 'failed')
            .reduce((newest, row) => Math.max(newest, row.at + 1), 0);
        await this._mesh.dispatch('retry-indexing', {
            knowledgeId: fileId,
            at: Math.max(Date.now(), failedAt)
        });
        return knowledge;
    }
    artifact(id) {
        return getKnowledgeArtifact(this._mesh, id);
    }
    artifacts(id) {
        return listKnowledgeArtifactsByKnowledge(this._mesh, { knowledgeId: id });
    }
    publish(input) {
        return addKnowledgeArtifact(this._mesh, input);
    }
    hasLiveSource(chatId, reference) {
        return hasLiveSource(this._mesh, chatId, reference);
    }
    async syncAttachments(chunks) {
        await this._mesh.fileIndex?.refresh(chunks);
        await this.reclaimAttachments(chunks);
    }
    async reclaimAttachments(chunks) {
        for (const chunk of chunks) {
            if (this._mesh.closing)
                return;
            await syncAttachmentChunk(this._mesh, chunk);
        }
    }
    syncKnowledge(row) {
        return syncKnowledgeTombstone(this._mesh, row);
    }
    syncArtifact(row) {
        return syncArtifactArrival(this._mesh, row);
    }
    reclaimPurged() {
        return reclaimPurgedFiles(this._mesh);
    }
    sweepTombstones(deviceId = null) {
        return sweepTombstonedBlobs(this._mesh, deviceId);
    }
    async sweepOrphans(coreLength) {
        if (!coreLength)
            return;
        const references = await referencedBlobs(this._mesh);
        if (!this._mesh.closing) {
            await this._store.sweep(references, coreLength);
        }
    }
    processorState(id) {
        let state = this._states.get(id);
        if (!state) {
            this._states.set(id, (state = new FileState()));
        }
        return state;
    }
    start(options) {
        this.startProcessor(new PreviewProcessor(options), options);
    }
    startProcessor(processor, options) {
        if (this._processors.has(processor.id)) {
            throw new Error(`processor already started: ${processor.id}`);
        }
        const work = new FileProcessing(this._mesh, { processor, ...options });
        this._processors.set(processor.id, { processor, work });
        if (this._paused) {
            void work.suspend();
        }
        work.start();
        this._updated();
    }
    async stopProcessor(id) {
        const entry = this._processors.get(id);
        if (!entry) {
            return true;
        }
        await entry.work.suspend();
        await entry.work.close();
        this._processors.delete(id);
        this.processorState(id).reset();
        this._updated();
        return entry.work.indexCleared;
    }
    get _processing() {
        return this._processors.get('rag')?.work;
    }
    startProcessing(options) {
        this.setModel(options.embedder.model);
        this.startProcessor(new RagProcessor({
            ...options,
            model: options.embedder.model,
            log: this._mesh.log
        }), { deviceId: options.deviceId, device: options.device });
    }
    rescan() {
        for (const { work } of this._processors.values()) {
            work.rescan();
        }
    }
    async stopProcessing() {
        const cleared = await this.stopProcessor('rag');
        this.setModel(null);
        return cleared;
    }
    async suspend() {
        this._paused = true;
        await Promise.all([...this._processors.values()].map(({ work }) => work.suspend()));
    }
    resume() {
        this._paused = false;
        for (const { work } of this._processors.values()) {
            work.resume();
        }
    }
    async listIndexing(chatId) {
        const rows = await listIndexingByChat(this._mesh, { chatId });
        let statuses = rows
            .filter((row) => !isProcessorArtifactId(row.id))
            .map((row) => ({ ...row, chatId, claimLive: isClaimLive(row, Date.now()) }));
        for (const file of (await this.status(chatId)).files) {
            const processor = file.processors.find((entry) => entry.processorId === 'rag');
            if (!processor || file.readyForChat || processor.state === 'not-applicable') {
                continue;
            }
            if (processor.claimedBy) {
                continue;
            }
            if (!processor.published && (this.state.get(file.fileId)?.sourceMisses ?? 0) < 2) {
                continue;
            }
            const attempts = statuses.filter((row) => row.knowledgeId === file.fileId);
            const latest = attempts.reduce((current, row) => (!current || row.at > current.at ? row : current), undefined);
            statuses = statuses.filter((row) => row.knowledgeId !== file.fileId);
            statuses.push({
                id: latest?.id ?? file.fileId,
                knowledgeId: file.fileId,
                chatId,
                status: processor.state === 'running' ? 'indexing' : 'failed',
                claimId: '',
                claimedBy: b4a.alloc(0),
                at: Math.max(latest?.at ?? 0, processor.retryAt ?? 0),
                expiresAt: 0,
                error: processor.reason ?? 'waiting for local index',
                claimLive: false
            });
        }
        return { statuses };
    }
    watch(listener) {
        this.on('update', listener);
    }
    unwatch(listener) {
        this.off('update', listener);
        if (!this.listenerCount('update')) {
            this._deadline.clear();
            this._pruneUploads();
        }
    }
    setModel(model) {
        if (model === this._model)
            return;
        this._model = model;
        this.state.reset();
        this._updated();
    }
    work(id, state, processorId = 'rag') {
        const entry = this.processorState(processorId).document(id);
        entry.sourceMisses = state.reason === 'source unavailable' ? (entry.sourceMisses ?? 0) + 1 : 0;
        entry.work = state;
        this._updated();
    }
    load(id, state, options = {}) {
        const { artifactId, processorId = 'rag' } = options;
        const entry = this.processorState(processorId).document(id);
        if (entry.load?.state !== 'failed' || state.state !== 'pending') {
            entry.load = state;
        }
        if (!artifactId) {
            entry.loaded = undefined;
        }
        else if (entry.loaded?.artifactId !== artifactId) {
            entry.loaded = { artifactId };
        }
        this._updated();
    }
    clearLoaded(processorId = 'rag') {
        this.processorState(processorId).clearLoaded();
        this._updated();
    }
    hydratedArtifact(id) {
        return this.state.get(id)?.loaded?.artifactId ?? null;
    }
    async settle(ids, options = {}) {
        if (!this._processing)
            return;
        await settleFiles(this, {
            ...options,
            ids,
            processing: this._processing,
            chatIds: async () => {
                const rows = await Promise.all(ids.map((id) => getKnowledge(this._mesh, id)));
                return [...new Set(rows.flatMap((row) => (row?.chatId ? [row.chatId] : [])))];
            }
        });
    }
    reconnect() {
        for (const { work } of this._processors.values()) {
            work.reconnect();
        }
        this._updated();
    }
    report = (update, processorId = 'rag') => {
        if (this.closed)
            return;
        this.processorState(processorId).document(update.knowledgeId).progress = {
            ...update,
            error: update.error ?? null
        };
        this._updated();
    };
    progress(chatId) {
        return this.state.progress(chatId);
    }
    async beginUpload(input) {
        const { chatId = null, fileName, mimeType } = input;
        if (!fileName || !mimeType) {
            throw new CoreError('UPLOAD_METADATA_INCOMPLETE');
        }
        const id = input.fileId || randomId();
        this._pruneUploads();
        const previous = this._uploads.get(id);
        if (previous && !previous.expiresAt) {
            throw new CoreError('FILE_ID_EXISTS');
        }
        this._uploads.set(id, {
            status: {
                fileId: id,
                chatId,
                fileName,
                mimeType,
                state: 'uploading',
                processors: [],
                readyForChat: false,
                uploadProgress: {
                    completed: input.data?.length ?? 0,
                    total: input.totalBytes || undefined,
                    unit: 'bytes'
                }
            }
        });
        try {
            if (input.fileId &&
                ((await getKnowledge(this._mesh, id)) ||
                    (await getChunk(this._mesh, id)) ||
                    (chatId &&
                        (await listChunks(this._mesh, { chatId, type: 'attachment' })).some((chunk) => chunk.attachment?.id === id)))) {
                throw new CoreError('FILE_ID_EXISTS');
            }
        }
        catch (error) {
            if (previous) {
                this._uploads.set(id, previous);
            }
            else {
                this._uploads.delete(id);
            }
            this._updated();
            throw error;
        }
        this._updated();
        return { id };
    }
    uploadProgress(id, bytes) {
        const upload = this._uploads.get(id)?.status;
        if (!upload?.uploadProgress) {
            return;
        }
        upload.uploadProgress.completed += bytes;
        this._updated();
    }
    uploadComplete(id) {
        const upload = this._uploads.get(id)?.status;
        if (upload) {
            upload.state = 'pending';
        }
        this._updated();
    }
    uploadFailed(id, error) {
        const upload = this._uploads.get(id)?.status;
        if (!upload) {
            return;
        }
        upload.state = error instanceof AbortedError ? 'cancelled' : 'failed';
        upload.reason = errorMessage(error);
        this._updated();
    }
    uploadClosed(id) {
        const upload = this._uploads.get(id);
        if (!upload || this.closed) {
            return;
        }
        upload.expiresAt = Date.now() + 60_000;
        this._deadline.schedule(upload.expiresAt);
    }
    _pruneUploads() {
        for (const [id, upload] of this._uploads) {
            if (!upload.expiresAt)
                continue;
            if (upload.expiresAt <= Date.now()) {
                this._uploads.delete(id);
            }
            else {
                this._deadline.schedule(upload.expiresAt);
            }
        }
    }
    async status(chatId) {
        this._pruneUploads();
        const snap = this._mesh.view.snapshot();
        const range = { gte: { chatId }, lte: { chatId } };
        try {
            const chat = await snap.get(CHATS, { id: chatId });
            if (!chat || chat.deletedAt) {
                return { files: [] };
            }
            const agent = await runDefinition(this._mesh, await snap.get(AGENTS, { id: chat.agentId }));
            const knowledge = await snap.find(ACTIVE_KNOWLEDGE_BY_CHAT, range).toArray();
            const chunks = await findChunksOfType(snap, { chatId, type: 'attachment' });
            const statuses = await snap.find(INDEXING_STATUS_BY_CHAT, range).toArray();
            const sources = new Map(knowledge.map((row) => [row.id, row]));
            const ragIds = new Set(sources.keys());
            for (const chunk of chunks) {
                const file = chunk.attachment;
                if (!file || file.deletedAt || chunk.sourceId || sources.has(file.id)) {
                    continue;
                }
                sources.set(file.id, { ...file, chatId, updatedAt: file.createdAt });
                if (chunk.runId || !isKnowledgeRoutedAttachment(file)) {
                    continue;
                }
                const record = await snap.get(KNOWLEDGE, { id: file.id });
                if (!record?.deletedAt) {
                    ragIds.add(file.id);
                }
            }
            const result = new Map();
            for (const { status: upload } of this._uploads.values()) {
                if (upload.chatId === chatId && upload.state !== 'pending') {
                    result.set(upload.fileId, {
                        ...upload,
                        chatId,
                        uploadProgress: upload.uploadProgress ? { ...upload.uploadProgress } : undefined
                    });
                }
            }
            for (const [id, source] of sources) {
                const rows = await snap
                    .find(KNOWLEDGE_ARTIFACTS_BY_KNOWLEDGE, {
                    gte: { knowledgeId: id },
                    lte: { knowledgeId: id }
                })
                    .toArray();
                const applicable = ragIds.has(id);
                const local = this.state.get(id);
                const output = rows.find((row) => !isProcessorOutput(row.embedderVersion) &&
                    (!this._model || row.embedderVersion.startsWith(`${this._model}|`)));
                const published = !!output;
                const attempts = statuses.filter((row) => row.knowledgeId === id && !isProcessorArtifactId(row.id));
                const claim = attempts.find((row) => isClaimLive(row, Date.now()));
                const failures = attempts.some((row) => row.status === 'ready')
                    ? []
                    : attempts.filter((row) => row.status === 'failed');
                const terminalFailure = failures.find((row) => row.error !== 'source unavailable' && row.error !== 'interrupted: suspend');
                const failed = terminalFailure ?? failures[0];
                const processor = {
                    processorId: 'rag',
                    state: 'pending',
                    published
                };
                processor.outputId = local?.loaded?.artifactId ?? output?.id;
                if (!applicable) {
                    processor.state = 'not-applicable';
                }
                else if (local?.loaded) {
                    processor.state = 'ready';
                }
                else if (claim) {
                    await this._markClaimed(processor, { snap, claim, agent });
                }
                else if (local?.work &&
                    !published &&
                    local.work.state !== 'running' &&
                    (!terminalFailure || !yieldsToVerdict(local.work))) {
                    Object.assign(processor, local.work);
                }
                else if (local?.load && published) {
                    Object.assign(processor, local.load);
                }
                else if (failed && !published && failed.error !== 'interrupted: suspend') {
                    processor.state = failed.error === 'source unavailable' ? 'pending' : 'failed';
                    processor.reason = parseFailure(failed.error).detail || 'processing failed';
                }
                else if (!this._model) {
                    processor.reason = 'model unavailable on this device';
                }
                else {
                    processor.reason = published ? 'waiting for local index' : 'waiting for agent';
                }
                if (local?.progress &&
                    processor.state !== 'not-applicable' &&
                    (!claim || b4a.equals(claim.claimedBy, this._mesh.localWriterKey))) {
                    processor.progress = {
                        completed: local.progress.processedChunks,
                        total: local.progress.totalChunks || undefined,
                        unit: 'chunks'
                    };
                }
                const readyForChat = applicable
                    ? processor.state === 'ready'
                    : await this._store.available(source.blobId);
                const processors = [
                    processor,
                    ...(await this._extraProcessorStatuses(id, { chunks, knowledge, rows, statuses }))
                ];
                const uploadProgress = this._uploads.get(id)?.status.uploadProgress;
                result.set(id, {
                    fileId: id,
                    chatId,
                    fileName: source.fileName,
                    mimeType: source.mimeType,
                    ...fileState(processor, { readyForChat, applicable }),
                    uploadProgress: uploadProgress ? { ...uploadProgress } : undefined,
                    processors,
                    readyForChat
                });
            }
            return { files: [...result.values()] };
        }
        finally {
            await snap.close();
        }
    }
    async _markClaimed(processor, { snap, claim, agent }) {
        processor.state = 'running';
        processor.claimedBy = claim.claimedBy;
        processor.expiresAt = claim.expiresAt;
        this._deadline.schedule(claim.expiresAt);
        const device = await liveDeviceForWriter(snap, claim.claimedBy);
        if (device && agent && b4a.equals(device.id, agent.providerDeviceId)) {
            processor.agentId = agent.id;
        }
    }
    async _extraProcessorStatuses(id, { chunks, knowledge, rows, statuses }) {
        const processors = [];
        for (const { processor: descriptor } of this._processors.values()) {
            if (descriptor.id === 'rag')
                continue;
            const chunk = chunks.find((entry) => entry.attachment?.id === id);
            const record = descriptor.input === 'attachment'
                ? chunk && attachmentRecord(chunk)
                : knowledge.find((entry) => entry.id === id);
            const input = record ? { ...record, kind: descriptor.input } : null;
            processors.push(!input || !descriptor.applies(input)
                ? { processorId: descriptor.id, state: 'not-applicable', published: false }
                : await this._processorStatus(descriptor, input, { rows, attempts: statuses }));
        }
        return processors;
    }
    async _processorStatus(processor, file, { rows, attempts }) {
        const output = rows.find((row) => processor.accepts ? processor.accepts(row, file) : row.embedderVersion === processor.version);
        const local = this.processorState(processor.id).get(file.id);
        const status = {
            processorId: processor.id,
            state: 'pending',
            published: !!output,
            outputId: output?.id
        };
        if (output &&
            (processor.load ? !!local?.loaded : await this._store.available(output.artifactBlobId))) {
            status.state = 'ready';
            return status;
        }
        const claim = attempts.find((row) => row.knowledgeId === file.id &&
            row.id.startsWith(`${processor.id}:`) &&
            isClaimLive(row, Date.now()));
        if (claim) {
            Object.assign(status, {
                state: 'running',
                claimedBy: claim.claimedBy,
                expiresAt: claim.expiresAt
            });
            this._deadline.schedule(claim.expiresAt);
        }
        else if (local?.work) {
            Object.assign(status, local.work);
        }
        else {
            status.reason = output ? 'output unavailable on this device' : 'waiting for processor';
        }
        return status;
    }
    async close() {
        this.closed = true;
        await Promise.all([...this._processors.keys()].map((id) => this.stopProcessor(id)));
        this._mesh.unwatch(this._updated);
        this._deadline.clear();
        this._uploads.clear();
        for (const state of this._states.values()) {
            state.close();
        }
        this._states.clear();
        this.emit('close');
        this.removeAllListeners();
        await this._store.close();
    }
}
function yieldsToVerdict(work) {
    return work.state === 'pending' || (work.state === 'failed' && work.retryAt === undefined);
}
function fileState(processor, opts) {
    if (opts.readyForChat) {
        return { state: 'ready', reason: undefined };
    }
    if (opts.applicable) {
        return { state: processor.state, reason: processor.reason };
    }
    return { state: 'pending', reason: 'source unavailable on this device' };
}
export { MemoryVectorIndex, RAG_KNOWLEDGE_OFF_NOTICE, RAG_TRUNCATED_NOTICE, RAG_UNAVAILABLE_NOTICE, WEB_TOOLS, chooseRagNotice, citedByPhraseOverlap, createRagSourceTagFilter, formatFullDocumentContext, formatRagContext, isFullTextHit, isWholeDocumentQuery, referencedDocuments, isTruncatedFullTextHit, sourcesFromHits, webSourcesFromToolResult, withoutDataChannel } from './rag/index.js';
export { attachTurnDocumentIds, groupAttachmentsByMessage } from './records/index.js';
export { CoreBlobServer, PENDING_BLOB_REFERENCE, isPendingBlobReference, parseBlobReferenceCoreKey } from './store/index.js';
