import { z } from 'zod';
/**
 * Storage modes of the native vector index. The `TURBOVEC_*` modes are the
 * quantised TurboVec formats and require a dimension divisible by 8 and no
 * greater than 1024. `F32`, `Q8` and `Q4` are the generic stores of the same
 * addon and accept any dimension. Declared as a name-to-value map, like
 * `ModelType`, so the contract carries the names for generated clients.
 */
export declare const VectorIndexStorage: {
    readonly F32: "f32";
    readonly Q8: "q8";
    readonly Q4: "q4";
    readonly TURBOVEC_Q4: "turbovec-q4";
    readonly TURBOVEC_Q2: "turbovec-q2";
};
export type VectorIndexStorage = (typeof VectorIndexStorage)[keyof typeof VectorIndexStorage];
export declare const vectorIndexStorageSchema: z.ZodEnum<{
    readonly F32: "f32";
    readonly Q8: "q8";
    readonly Q4: "q4";
    readonly TURBOVEC_Q4: "turbovec-q4";
    readonly TURBOVEC_Q2: "turbovec-q2";
}>;
export declare const DEFAULT_VECTOR_INDEX_STORAGE: VectorIndexStorage;
/**
 * The native index pads short search result rows with UINT64_MAX, so that
 * value can never be used as an id.
 */
export declare const VECTOR_ID_RESERVED = "18446744073709551615";
/**
 * An id as it travels over the wire: a decimal string holding an unsigned
 * 64-bit integer, or a non-negative safe integer. Results always use the
 * string form so values above 2^53 survive JSON.
 */
export declare const vectorIdWireSchema: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
export type VectorIdWire = z.infer<typeof vectorIdWireSchema>;
/** An id as callers pass it. A `bigint` is converted to its decimal string before sending. */
export type VectorId = VectorIdWire | bigint;
export declare const createVectorIndexParamsSchema: z.ZodObject<{
    dim: z.ZodNumber;
    storage: z.ZodDefault<z.ZodEnum<{
        readonly F32: "f32";
        readonly Q8: "q8";
        readonly Q4: "q4";
        readonly TURBOVEC_Q4: "turbovec-q4";
        readonly TURBOVEC_Q2: "turbovec-q2";
    }>>;
}, z.core.$strip>;
export declare const loadVectorIndexParamsSchema: z.ZodObject<{
    path: z.ZodString;
}, z.core.$strip>;
export declare const vectorIndexAddParamsSchema: z.ZodObject<{
    ids: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    vectors: z.ZodArray<z.ZodArray<z.ZodNumber>>;
}, z.core.$strip>;
export declare const vectorIndexSearchParamsSchema: z.ZodObject<{
    queries: z.ZodArray<z.ZodArray<z.ZodNumber>>;
    k: z.ZodNumber;
}, z.core.$strip>;
export declare const vectorIndexIdsParamsSchema: z.ZodObject<{
    ids: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
}, z.core.$strip>;
export declare const vectorIndexWriteParamsSchema: z.ZodObject<{
    path: z.ZodString;
}, z.core.$strip>;
export declare const vectorIndexRequestSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    dim: z.ZodNumber;
    storage: z.ZodDefault<z.ZodEnum<{
        readonly F32: "f32";
        readonly Q8: "q8";
        readonly Q4: "q4";
        readonly TURBOVEC_Q4: "turbovec-q4";
        readonly TURBOVEC_Q2: "turbovec-q2";
    }>>;
    operation: z.ZodLiteral<"create">;
    type: z.ZodLiteral<"vectorIndex">;
}, z.core.$strip>, z.ZodObject<{
    path: z.ZodString;
    operation: z.ZodLiteral<"load">;
    type: z.ZodLiteral<"vectorIndex">;
}, z.core.$strip>, z.ZodObject<{
    ids: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    vectors: z.ZodArray<z.ZodArray<z.ZodNumber>>;
    operation: z.ZodLiteral<"add">;
    indexId: z.ZodString;
    type: z.ZodLiteral<"vectorIndex">;
}, z.core.$strip>, z.ZodObject<{
    queries: z.ZodArray<z.ZodArray<z.ZodNumber>>;
    k: z.ZodNumber;
    operation: z.ZodLiteral<"search">;
    indexId: z.ZodString;
    type: z.ZodLiteral<"vectorIndex">;
}, z.core.$strip>, z.ZodObject<{
    ids: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    operation: z.ZodLiteral<"remove">;
    indexId: z.ZodString;
    type: z.ZodLiteral<"vectorIndex">;
}, z.core.$strip>, z.ZodObject<{
    ids: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    operation: z.ZodLiteral<"contains">;
    indexId: z.ZodString;
    type: z.ZodLiteral<"vectorIndex">;
}, z.core.$strip>, z.ZodObject<{
    path: z.ZodString;
    operation: z.ZodLiteral<"write">;
    indexId: z.ZodString;
    type: z.ZodLiteral<"vectorIndex">;
}, z.core.$strip>, z.ZodObject<{
    operation: z.ZodLiteral<"dispose">;
    indexId: z.ZodString;
    type: z.ZodLiteral<"vectorIndex">;
}, z.core.$strip>], "operation">;
export declare const vectorIndexHitSchema: z.ZodObject<{
    id: z.ZodString;
    score: z.ZodNumber;
}, z.core.$strip>;
export declare const vectorIndexResponseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"vectorIndex">;
    operation: z.ZodLiteral<"create">;
    indexId: z.ZodString;
    dim: z.ZodNumber;
    storage: z.ZodEnum<{
        readonly F32: "f32";
        readonly Q8: "q8";
        readonly Q4: "q4";
        readonly TURBOVEC_Q4: "turbovec-q4";
        readonly TURBOVEC_Q2: "turbovec-q2";
    }>;
    length: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"vectorIndex">;
    operation: z.ZodLiteral<"load">;
    indexId: z.ZodString;
    dim: z.ZodNumber;
    storage: z.ZodOptional<z.ZodEnum<{
        readonly F32: "f32";
        readonly Q8: "q8";
        readonly Q4: "q4";
        readonly TURBOVEC_Q4: "turbovec-q4";
        readonly TURBOVEC_Q2: "turbovec-q2";
    }>>;
    length: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"vectorIndex">;
    operation: z.ZodLiteral<"add">;
    length: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"vectorIndex">;
    operation: z.ZodLiteral<"search">;
    results: z.ZodArray<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        score: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"vectorIndex">;
    operation: z.ZodLiteral<"remove">;
    removed: z.ZodArray<z.ZodBoolean>;
    length: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"vectorIndex">;
    operation: z.ZodLiteral<"contains">;
    present: z.ZodArray<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"vectorIndex">;
    operation: z.ZodLiteral<"write">;
    path: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"vectorIndex">;
    operation: z.ZodLiteral<"dispose">;
    disposed: z.ZodBoolean;
}, z.core.$strip>], "operation">;
export type VectorIndexRequest = z.input<typeof vectorIndexRequestSchema>;
export type VectorIndexResponse = z.infer<typeof vectorIndexResponseSchema>;
export type VectorIndexHit = z.infer<typeof vectorIndexHitSchema>;
export type CreateVectorIndexParams = z.input<typeof createVectorIndexParamsSchema>;
export type LoadVectorIndexParams = z.infer<typeof loadVectorIndexParamsSchema>;
export interface VectorIndexAddParams {
    ids: VectorId[];
    vectors: number[][];
}
export interface VectorIndexIdsParams {
    ids: VectorId[];
}
export type VectorIndexSearchParams = {
    query: number[];
    k: number;
} | {
    queries: number[][];
    k: number;
};
export type VectorIndexWriteParams = z.infer<typeof vectorIndexWriteParamsSchema>;
export declare function toWireVectorIds(ids: readonly VectorId[]): VectorIdWire[];
/** Index of the first row whose length differs from `dim`, or -1 when every row matches. */
export declare function findVectorRowLengthMismatch(rows: readonly (readonly number[])[], dim: number): number;
