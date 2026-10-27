export interface Shard {
    readonly url: string;
    readonly filename: string;
}
export interface ShardSet {
    readonly base: string;
    readonly baseUrl: string;
    readonly extension: string;
    readonly shards: ReadonlyArray<Shard>;
}
export declare function shardSet(src: string): ShardSet | null;
