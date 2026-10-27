import { toolsetEnabled } from '@qvac/harness/lib/tools/toolsets.ts';
import { getAgent } from '../core/agent.js';
import { runDefinition } from '../core/shared-agents.js';
import { getChat } from '../core/chat.js';
import { chatProject } from '../core/chat-project.js';
import { isKnowledgeRoutedAttachment, fullTextBudgetChars, fullTextHits, joinedIndex, retrieveRagKnowledge, searchRagChunks, referencesPendingFile } from '../core/files/index.js';
import { heldMesh, requireMesh } from './current-mesh.js';
import { errorMessage } from '../guards.js';
import b4a from 'b4a';
export const MAX_RAG_SEARCH_LIMIT = 20;
const DEFAULT_RAG_SEARCH_LIMIT = 5;
function clampLimit(limit) {
    if (typeof limit !== 'number' || limit <= 0)
        return DEFAULT_RAG_SEARCH_LIMIT;
    return Math.min(Math.max(1, Math.floor(limit)), MAX_RAG_SEARCH_LIMIT);
}
export function createRagApi(pool, { index, embedder, effectiveCtxSize = null }) {
    return {
        ragSearch: async ({ chatId, query, mode, limit, attachmentIds, meshId }) => {
            let pendingFiles = [];
            let projectFilesNotReady = 0;
            const respond = (overrides) => {
                const result = response({ pendingFiles, projectFilesNotReady, ...overrides });
                return { ...result, chatFilesNotReady: result.pendingFiles?.length ?? 0 };
            };
            const mesh = await requireMesh(pool, meshId);
            const chat = await getChat(mesh, chatId);
            const toolMode = mode === 'tool';
            if (!chat) {
                return respond({ enabled: false });
            }
            const agent = await runDefinition(mesh, await getAgent(mesh, chat.agentId));
            const scopeIds = new Set(toolMode ? [] : (attachmentIds ?? []));
            const off = new Set(chat.knowledgeSourcesOff ?? []);
            const kept = (id) => !off.has('chat') || scopeIds.has(id);
            const chatKnowledge = async () => (await mesh.files.listKnowledge(chatId)).filter((row) => kept(row.id));
            const chatFiles = async () => (await mesh.files.status(chatId)).files.filter((file) => kept(file.fileId));
            let chatRows = await chatKnowledge();
            const initialFiles = await chatFiles();
            pendingFiles = pendingFileNames(initialFiles);
            let scopeRows = chatRows.filter((row) => scopeIds.has(row.id));
            const project = off.has('project')
                ? null
                : await chatProject(mesh, chatId, (id) => heldMesh(pool, id));
            const kbEntries = project ? ((await project.files.knowledgeBase()).entries ?? []) : [];
            const kbRows = kbEntries.filter((entry) => entry.loaded).map((entry) => entry.knowledge);
            projectFilesNotReady = kbEntries.filter((entry) => !entry.loaded && entry.status !== 'failed').length;
            if (scopeIds.size > 0 && scopeRows.length === scopeIds.size) {
                const ctxSize = effectiveCtxSize ? await effectiveCtxSize(agent) : 0;
                const fullText = await fullTextHits(mesh, scopeRows, {
                    budgetChars: fullTextBudgetChars(ctxSize),
                    head: !agentAllowsRagSearch(agent)
                });
                if (fullText) {
                    return respond({
                        pendingFiles: pendingFileNames(initialFiles, new Set(scopeRows.map((row) => row.id))),
                        searchedCount: fullText.length,
                        indexEmpty: false,
                        hasKnowledge: true,
                        availableFiles: [...new Set(scopeRows.map((row) => row.fileName))],
                        hits: fullText
                    });
                }
            }
            if (!toolMode && !agentAllowsRagSearch(agent)) {
                return respond({ enabled: false });
            }
            if (chatRows.length === 0 && kbRows.length === 0) {
                return respond({});
            }
            const waiting = scopeRows.filter((row) => !mesh.files.hydratedArtifact(row.id));
            if (waiting.length) {
                try {
                    await mesh.files.settle(waiting.map((row) => row.id));
                }
                catch (err) {
                    mesh.log?.warn('rag', 'indexing settle failed', { err });
                }
                chatRows = await chatKnowledge();
                scopeRows = chatRows.filter((row) => scopeIds.has(row.id));
            }
            const rows = [...chatRows, ...kbRows];
            const hasKnowledge = rows.length > 0;
            const chatIndex = index(meshId);
            const embed = embedder(meshId);
            if (!chatIndex || !embed) {
                return respond({ hasKnowledge, errorMessage: 'knowledge index unavailable on this device' });
            }
            const projectIndex = project && kbRows.length ? index(b4a.toHex(project.key)) : null;
            const vectorIndex = projectIndex
                ? joinedIndex([chatIndex, projectIndex], {
                    chatId,
                    knowledgeBaseIds: new Set(kbRows.map((row) => row.id))
                })
                : chatIndex;
            const artifactByRow = new Map([
                ...chatRows.map((row) => [row, mesh.files.hydratedArtifact(row.id)]),
                ...kbRows.map((row) => [row, project?.files.hydratedArtifact(row.id) ?? null])
            ]);
            const hydratedDocuments = [];
            for (const [row, artifactId] of artifactByRow) {
                if (artifactId) {
                    hydratedDocuments.push({ documentId: artifactId, title: row.fileName });
                }
            }
            const indexEmpty = hydratedDocuments.length === 0;
            const availableFiles = [...new Set(hydratedDocuments.map((document) => document.title))];
            const failedRows = new Set();
            const fileStates = await chatFiles();
            for (const row of rows) {
                if (artifactByRow.get(row))
                    continue;
                if (fileStates.find((file) => file.fileId === row.id)?.state === 'failed') {
                    failedRows.add(row);
                }
            }
            pendingFiles = pendingFileNames(fileStates, new Set(rows.filter((row) => artifactByRow.get(row)).map((row) => row.id)));
            const failedFiles = scopeRows.filter((row) => failedRows.has(row)).map((row) => row.fileName);
            const scopeDocumentIds = [];
            let scopePending = false;
            for (const row of scopeRows) {
                const artifactId = artifactByRow.get(row);
                if (artifactId) {
                    scopeDocumentIds.push(artifactId);
                }
                else if (!failedRows.has(row)) {
                    scopePending = true;
                }
            }
            if (scopePending && scopeDocumentIds.length === 0) {
                return respond({
                    pendingReferenced: true,
                    indexEmpty,
                    hasKnowledge,
                    availableFiles,
                    failedFiles
                });
            }
            const pendingReferenced = scopeDocumentIds.length === 0 &&
                referencesPendingFile(query, rows.map((row) => ({
                    title: row.fileName,
                    pending: !artifactByRow.get(row) && !failedRows.has(row)
                })));
            if (pendingReferenced) {
                return respond({ pendingReferenced, indexEmpty, hasKnowledge, availableFiles, failedFiles });
            }
            const failedReferenced = scopeRows.length === 0 &&
                failedRows.size > 0 &&
                referencesPendingFile(query, rows.map((row) => ({ title: row.fileName, pending: failedRows.has(row) })));
            if (failedReferenced) {
                return respond({
                    indexEmpty,
                    hasKnowledge,
                    availableFiles,
                    failedFiles: rows.filter((row) => failedRows.has(row)).map((row) => row.fileName)
                });
            }
            const allFailed = indexEmpty && rows.length > 0 && rows.every((row) => failedRows.has(row));
            if (allFailed) {
                return respond({
                    indexEmpty,
                    hasKnowledge,
                    availableFiles,
                    failedFiles: rows.map((row) => row.fileName)
                });
            }
            if (toolMode) {
                try {
                    const hits = await searchRagChunks({
                        query,
                        chatId,
                        limit: clampLimit(limit),
                        liveSourceIds: rows.map((row) => row.id)
                    }, {
                        index: vectorIndex,
                        embed: (texts) => embed.embed({ texts }),
                        debug: (message) => mesh.log?.debug('rag', message)
                    });
                    return respond({
                        searchedCount: hits.length,
                        indexEmpty,
                        hasKnowledge,
                        availableFiles,
                        hits: hits.map(toWireHit)
                    });
                }
                catch (err) {
                    return respond({
                        indexEmpty,
                        hasKnowledge,
                        availableFiles,
                        errorMessage: errorMessage(err)
                    });
                }
            }
            try {
                const result = await retrieveRagKnowledge({
                    query,
                    chatId,
                    documents: hydratedDocuments,
                    liveSourceIds: rows.map((row) => row.id),
                    scopeDocumentIds: scopeDocumentIds.length > 0 ? scopeDocumentIds : undefined
                }, {
                    index: vectorIndex,
                    embed: (texts) => embed.embed({ texts }),
                    debug: (message) => mesh.log?.debug('rag', message)
                });
                return respond({
                    searchedCount: result.searchedCount,
                    indexEmpty,
                    hasKnowledge,
                    targetDocumentId: result.targetDocumentId,
                    availableFiles,
                    failedFiles,
                    hits: result.hits.map(toWireHit)
                });
            }
            catch (err) {
                return respond({
                    indexEmpty,
                    hasKnowledge,
                    availableFiles,
                    failedFiles,
                    errorMessage: errorMessage(err)
                });
            }
        }
    };
}
function toWireHit(hit) {
    return { id: hit.id, content: hit.content, metadataJson: hit.metadataJson, score: hit.score };
}
function pendingFileNames(files, available = new Set()) {
    return files
        .filter((file) => !available.has(file.fileId) &&
        ['pending', 'running', 'uploading'].includes(file.state) &&
        (file.state === 'uploading'
            ? isKnowledgeRoutedAttachment(file)
            : file.processors.some((processor) => processor.processorId === 'rag' && processor.state !== 'not-applicable')))
        .map((file) => file.fileName);
}
function response(overrides) {
    return {
        enabled: true,
        searchedCount: 0,
        indexEmpty: true,
        hasKnowledge: false,
        availableFiles: [],
        hits: [],
        ...overrides
    };
}
function agentAllowsRagSearch(agent) {
    if (!agent)
        return false;
    return toolsetEnabled('knowledge', agent.disabledToolsets);
}
