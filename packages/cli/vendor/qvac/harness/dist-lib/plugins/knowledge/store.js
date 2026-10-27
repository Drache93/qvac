import fs from 'fs';
import path from 'path';
import { isRecord } from '../../lib/guards.js';
const INDEX_FILE = 'knowledge.qvi';
const MANIFEST_FILE = 'knowledge.json';
const DEFAULT_K = 5;
const DEFAULT_MIN_SCORE = 0.4;
const VECTOR_INDEX_NOT_FOUND = 52851;
function emptyManifest(model) {
    return { model, dimensions: 0, nextId: 1, seq: 0, artifacts: {} };
}
function isManifest(value) {
    return (isRecord(value) &&
        typeof value.model === 'string' &&
        typeof value.dimensions === 'number' &&
        typeof value.nextId === 'number' &&
        typeof value.seq === 'number' &&
        isRecord(value.artifacts));
}
function unit(vector) {
    const norm = Math.hypot(...vector);
    return norm > 0 ? vector.map((value) => value / norm) : vector;
}
function storageFor(dim) {
    return dim % 8 === 0 && dim <= 1024 ? 'turbovec-q4' : 'f32';
}
function matches(embedding, want) {
    return (embedding !== undefined &&
        embedding.model === want.model &&
        (want.dimensions === 0 || embedding.dimensions === want.dimensions) &&
        embedding.vectors.length === want.chunks &&
        embedding.vectors.every((row) => row.length === embedding.dimensions));
}
function isNotFound(error) {
    return isRecord(error) && error.code === VECTOR_INDEX_NOT_FOUND;
}
export class KnowledgeStore {
    _dir;
    _model;
    _maxChunks;
    _minScore;
    _embed;
    _manifest;
    _index;
    _opened;
    _lane;
    constructor({ dir, model, maxChunks = Infinity, minScore = DEFAULT_MIN_SCORE, embed }) {
        this._dir = dir;
        this._model = model;
        this._maxChunks = maxChunks;
        this._minScore = minScore;
        this._embed = embed;
        this._manifest = emptyManifest(model);
        this._index = null;
        this._opened = null;
        this._lane = Promise.resolve();
    }
    upsert(artifact) {
        return this._serial(() => this._upsert(artifact));
    }
    remove(artifactId) {
        return this._serial(async () => {
            const removed = await this._drop(artifactId);
            await this._persist();
            return { removed };
        });
    }
    search(query) {
        return this._serial(() => this._search(query));
    }
    status() {
        return this._serial(async () => {
            const { model, dimensions, artifacts } = this._manifest;
            const entries = Object.entries(artifacts).map(([artifactId, stored]) => ({
                artifactId,
                version: stored.version,
                scope: stored.scope,
                chunks: stored.chunks.length
            }));
            const chunks = entries.reduce((sum, entry) => sum + entry.chunks, 0);
            return { model, dimensions, chunks, artifacts: entries };
        });
    }
    async close() {
        await this._lane.catch(noop);
        await this._index?.dispose().catch(noop);
        this._index = null;
    }
    _serial(run) {
        const job = this._lane.then(async () => {
            this._opened ??= this._open().catch((error) => {
                this._opened = null;
                throw error;
            });
            await this._opened;
            return this._recovering(run);
        });
        this._lane = job.catch(noop);
        return job;
    }
    async _recovering(run) {
        try {
            return await run();
        }
        catch (error) {
            if (!isNotFound(error)) {
                throw error;
            }
            this._index = null;
            await this._open();
            return run();
        }
    }
    async _open() {
        const saved = await readManifest(this._file(MANIFEST_FILE));
        if (!saved || saved.model !== this._model) {
            this._manifest = saved ?? emptyManifest(this._model);
            await this._rebuild();
            return;
        }
        this._manifest = saved;
        const chunks = this._chunkCount();
        if (chunks === 0) {
            return;
        }
        try {
            const { loadVectorIndex } = await this._embed.sdk();
            const index = await loadVectorIndex({ path: this._file(INDEX_FILE) });
            if (index.dim === saved.dimensions && index.length === chunks) {
                this._index = index;
                return;
            }
            await index.dispose();
        }
        catch {
        }
        await this._rebuild();
    }
    async _rebuild() {
        const kept = Object.entries(this._manifest.artifacts).sort(([, a], [, b]) => a.seq - b.seq);
        const stale = this._index;
        this._manifest = { ...emptyManifest(this._model), seq: this._manifest.seq };
        this._index = null;
        try {
            for (const [artifactId, stored] of kept) {
                const chunks = stored.chunks.map(({ chunkId, text, metadata }) => ({
                    id: chunkId,
                    text,
                    metadata
                }));
                const artifact = { artifactId, version: stored.version, scope: stored.scope, chunks };
                await this._add(artifact, { heal: false });
            }
        }
        catch (error) {
            await this._unload();
            throw error;
        }
        finally {
            await stale?.dispose().catch(noop);
        }
        await this._persist();
    }
    async _unload() {
        await this._index?.dispose().catch(noop);
        this._index = null;
        this._opened = null;
    }
    async _upsert(artifact) {
        await this._drop(artifact.artifactId);
        const result = await this._add(artifact);
        await this._evict(artifact.artifactId);
        await this._persist();
        return result;
    }
    async _add(artifact, { heal = true } = {}) {
        const { artifactId, version, scope, chunks, embedding } = artifact;
        if (chunks.length === 0) {
            return { added: 0, embedded: null };
        }
        const want = {
            model: this._model,
            dimensions: this._manifest.dimensions,
            chunks: chunks.length
        };
        const embedded = matches(embedding, want) ? null : await this._embedChunks(artifact);
        const vectors = embedded?.vectors ?? embedding?.vectors ?? [];
        const dim = vectors[0]?.length ?? 0;
        if (heal && this._index && this._index.dim !== dim) {
            await this._rebuild();
        }
        const index = await this._indexFor(dim);
        const manifest = this._manifest;
        const stored = chunks.map((chunk) => ({
            id: String(manifest.nextId++),
            chunkId: chunk.id,
            text: chunk.text,
            metadata: chunk.metadata
        }));
        await index.add({ ids: stored.map((chunk) => chunk.id), vectors: vectors.map(unit) });
        manifest.seq++;
        manifest.artifacts[artifactId] = {
            version,
            scope,
            seq: manifest.seq,
            chunks: stored
        };
        return { added: stored.length, embedded };
    }
    async _embedChunks({ chunks }) {
        const vectors = await this._embed.embed({
            model: this._model,
            texts: chunks.map((chunk) => chunk.text)
        });
        if (vectors.length !== chunks.length) {
            throw new Error(`embed returned ${vectors.length} vectors for ${chunks.length} chunks`);
        }
        return { model: this._model, dimensions: vectors[0]?.length ?? 0, vectors };
    }
    async _indexFor(dim) {
        if (this._index) {
            if (this._index.dim !== dim) {
                throw new Error(`the knowledge index holds ${this._index.dim} dimensions, not ${dim}`);
            }
            return this._index;
        }
        const { createVectorIndex } = await this._embed.sdk();
        this._index = await createVectorIndex({ dim, storage: storageFor(dim) });
        this._manifest.dimensions = dim;
        return this._index;
    }
    async _drop(artifactId) {
        const stored = this._manifest.artifacts[artifactId];
        if (!stored) {
            return 0;
        }
        if (this._index && stored.chunks.length) {
            await this._index.remove({ ids: stored.chunks.map((chunk) => chunk.id) });
        }
        delete this._manifest.artifacts[artifactId];
        return stored.chunks.length;
    }
    async _evict(keep) {
        const oldest = Object.entries(this._manifest.artifacts)
            .filter(([artifactId]) => artifactId !== keep)
            .sort(([, a], [, b]) => a.seq - b.seq);
        let total = this._chunkCount();
        for (const [artifactId] of oldest) {
            if (total <= this._maxChunks)
                return;
            total -= await this._drop(artifactId);
        }
    }
    async _search({ text, scopes, k = DEFAULT_K, signal }) {
        const granted = new Set(scopes);
        const inScope = Object.values(this._manifest.artifacts)
            .filter((stored) => granted.has(stored.scope))
            .reduce((sum, stored) => sum + stored.chunks.length, 0);
        if (!this._index || inScope === 0 || k <= 0) {
            return [];
        }
        const [query = []] = await this._embed.embed({ model: this._model, texts: [text], signal });
        if (query.length !== this._index.dim) {
            await this._rebuild();
        }
        const index = this._index;
        const byId = this._chunksById(granted);
        const want = Math.min(k, inScope);
        let fetch = Math.min(index.length, want * 4);
        for (;;) {
            const hits = await index.search({ query: unit(query), k: fetch });
            const found = hits.flatMap((hit) => {
                const entry = byId.get(hit.id);
                return entry && hit.score >= this._minScore ? [{ ...entry, score: hit.score }] : [];
            });
            const floored = (hits.at(-1)?.score ?? -Infinity) < this._minScore;
            if (found.length >= want || floored || fetch >= index.length) {
                return found.slice(0, k);
            }
            fetch = Math.min(index.length, fetch * 4);
        }
    }
    _chunksById(granted) {
        const byId = new Map();
        for (const [artifactId, stored] of Object.entries(this._manifest.artifacts)) {
            if (!granted.has(stored.scope))
                continue;
            for (const chunk of stored.chunks) {
                byId.set(chunk.id, {
                    artifactId,
                    chunkId: chunk.chunkId,
                    scope: stored.scope,
                    text: chunk.text,
                    metadata: chunk.metadata
                });
            }
        }
        return byId;
    }
    _chunkCount() {
        return Object.values(this._manifest.artifacts).reduce((sum, stored) => sum + stored.chunks.length, 0);
    }
    _file(name) {
        return path.join(this._dir, name);
    }
    async _persist() {
        await fs.promises.mkdir(this._dir, { recursive: true });
        const snapshot = this._file(INDEX_FILE);
        if (this._index && this._chunkCount() > 0) {
            await this._index.write({ path: snapshot });
        }
        else {
            await this._index?.dispose();
            this._index = null;
            this._manifest.dimensions = 0;
            await fs.promises.rm(snapshot, { force: true });
        }
        const manifest = this._file(MANIFEST_FILE);
        await fs.promises.writeFile(`${manifest}.tmp`, JSON.stringify(this._manifest));
        await fs.promises.rename(`${manifest}.tmp`, manifest);
    }
}
async function readManifest(file) {
    try {
        const value = JSON.parse(await fs.promises.readFile(file, 'utf8'));
        return isManifest(value) ? value : null;
    }
    catch {
        return null;
    }
}
function noop() { }
