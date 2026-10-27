import { send } from '../rpc/rpc-client.js';
import { DEFAULT_VECTOR_INDEX_STORAGE, findVectorRowLengthMismatch, toWireVectorIds } from '@qvac/inference/surface';
import { InvalidOperationError, InvalidResponseError, RequestValidationFailedError } from '../../utils/errors-client.js';
/**
 * Builds the two public functions over a transport. The default export pair
 * below binds them to the RPC client; tests bind a fake instead.
 */
export function createVectorIndexClient(transport) {
    async function call(request, options) {
        const response = await transport(request, options);
        if (response.type !== 'vectorIndex') {
            throw new InvalidResponseError('vectorIndex');
        }
        if (response.operation !== request.operation) {
            throw new InvalidOperationError();
        }
        return response;
    }
    function createHandle(opened) {
        const { indexId, dim, storage } = opened;
        let length = opened.length;
        let disposed = false;
        // Row lengths are checked here so a mismatch fails before any request is
        // sent and before the worker touches native memory.
        function assertRows(rows, label) {
            const mismatch = findVectorRowLengthMismatch(rows, dim);
            if (mismatch === -1)
                return;
            throw new RequestValidationFailedError(`${label}[${mismatch}] has ${rows[mismatch]?.length ?? 0} components, expected ${dim}`);
        }
        // The flag is set only after the worker confirms, so a failed dispose
        // can be retried instead of leaking the index until worker shutdown.
        async function dispose(options) {
            if (disposed)
                return;
            await call({ type: 'vectorIndex', operation: 'dispose', indexId }, options);
            disposed = true;
        }
        async function search(params, options) {
            const queries = 'queries' in params ? params.queries : [params.query];
            assertRows(queries, 'queries');
            const response = await call({ type: 'vectorIndex', operation: 'search', indexId, queries, k: params.k }, options);
            return 'queries' in params ? response.results : (response.results[0] ?? []);
        }
        const handle = {
            indexId,
            dim,
            storage,
            get length() {
                return length;
            },
            async add(params, options) {
                assertRows(params.vectors, 'vectors');
                const response = await call({
                    type: 'vectorIndex',
                    operation: 'add',
                    indexId,
                    ids: toWireVectorIds(params.ids),
                    vectors: params.vectors
                }, options);
                length = response.length;
                return { length };
            },
            search,
            async remove(params, options) {
                const response = await call({ type: 'vectorIndex', operation: 'remove', indexId, ids: toWireVectorIds(params.ids) }, options);
                length = response.length;
                return response.removed;
            },
            async contains(params, options) {
                const response = await call({ type: 'vectorIndex', operation: 'contains', indexId, ids: toWireVectorIds(params.ids) }, options);
                return response.present;
            },
            async write(params, options) {
                const response = await call({ type: 'vectorIndex', operation: 'write', indexId, path: params.path }, options);
                return { path: response.path };
            },
            dispose
        };
        // Older runtimes without explicit resource management have no symbol to
        // key the method on; `dispose()` remains available there.
        if (typeof Symbol.asyncDispose === 'symbol') {
            Object.defineProperty(handle, Symbol.asyncDispose, {
                value: () => dispose(),
                enumerable: false
            });
        }
        return handle;
    }
    return {
        async createVectorIndex(params, options) {
            const response = await call({
                type: 'vectorIndex',
                operation: 'create',
                dim: params.dim,
                storage: params.storage ?? DEFAULT_VECTOR_INDEX_STORAGE
            }, options);
            return createHandle(response);
        },
        async loadVectorIndex(params, options) {
            const response = await call({ type: 'vectorIndex', operation: 'load', path: params.path }, options);
            return createHandle(response);
        }
    };
}
const client = createVectorIndexClient(send);
/**
 * Creates an empty vector index in worker memory and returns a handle to it.
 *
 * The index is backed by the native TurboVec engine of the registered
 * embedding plugin (the built-in llama.cpp embedding plugin provides it).
 * Pair it with `embed()` to build retrieval over documents kept in any store:
 * add each document's embedding under an id of your choosing, then search
 * with the embedding of a query and map the returned ids back to your
 * documents.
 *
 * @param params - Index parameters
 * @param params.dim - Vector dimensionality, for example 1024 for GTE Large. TurboVec storage needs a multiple of 8 no greater than 1024.
 * @param params.storage - Storage mode from `VectorIndexStorage`; defaults to `TURBOVEC_Q4`. `TURBOVEC_Q2` halves memory again at lower recall; `F32`, `Q8`, and `Q4` are exact or generically quantised stores for dimensions TurboVec cannot hold.
 * @param options - Optional RPC options (timeout, profiling, force new connection, etc.).
 * @returns A handle whose methods add, search, remove, snapshot, and dispose the index.
 * @throws {VectorIndexProviderUnavailableError} When no registered plugin exposes a vector index provider
 * @throws {VectorIndexFailedError} When the native index rejects the dimension or storage mode
 *
 * @example
 * ```typescript
 * const documents = new Map([
 *   ['1', 'Saturn moon Titan has lakes of liquid methane.'],
 *   ['2', 'Solar panels turn sunlight into electricity.']
 * ])
 * const { embedding } = await embed({ modelId, text: [...documents.values()] })
 *
 * await using index = await createVectorIndex({ dim: embedding[0].length })
 * await index.add({ ids: [...documents.keys()], vectors: embedding })
 *
 * const { embedding: query } = await embed({ modelId, text: 'Which moon has methane lakes?' })
 * const hits = await index.search({ query, k: 1 })
 * console.log(documents.get(hits[0].id))
 * ```
 */
export function createVectorIndex(params, options) {
    return client.createVectorIndex(params, options);
}
/**
 * Loads a vector index snapshot written by `VectorIndex.write()` into worker
 * memory and returns a handle to it.
 *
 * The snapshot records its dimension, storage mode, and entries, so nothing
 * else needs to be supplied. Loading copies the file into memory; later
 * changes are not written back until `write()` is called again.
 *
 * @param params - Load parameters
 * @param params.path - Snapshot path. An absolute path is used as given; a relative path resolves under the QVAC data directory, the same rule `write()` applies.
 * @param options - Optional RPC options (timeout, profiling, force new connection, etc.).
 * @returns A handle to the loaded index.
 * @throws {VectorIndexProviderUnavailableError} When no registered plugin exposes a vector index provider
 * @throws {VectorIndexFailedError} When the file is missing, corrupt, or not a vector index snapshot
 *
 * @example
 * ```typescript
 * const index = await loadVectorIndex({ path: 'indexes/articles.qvi' })
 * const hits = await index.search({ query, k: 5 })
 * await index.dispose()
 * ```
 */
export function loadVectorIndex(params, options) {
    return client.loadVectorIndex(params, options);
}
