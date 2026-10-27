import type HyperDB from 'hyperdb';
import type { ReadChunk } from './chunk.ts';
import type { Mesh } from './mesh.ts';
export interface Senders {
    readonly names: ReadonlyMap<string, string>;
    readonly live: ReadonlySet<string>;
    readonly inProject: ReadonlySet<string>;
}
export type SenderLookup = (meshId: string) => Promise<Senders | null>;
export type SentChunk = ReadChunk & {
    readonly senderName?: string | undefined;
    readonly senderNotInProject?: boolean;
    readonly senderFormerMember?: boolean;
    readonly senderCopiedBy?: Buffer | undefined;
};
export declare function projectSenders(workspace: HyperDB, project: HyperDB): Promise<Senders>;
export declare function ourSenderName(mesh: Mesh, meshId: string, lookup: SenderLookup | null | undefined): Promise<string | undefined>;
export declare function withSenders(chunks: ReadonlyArray<ReadChunk>, senders: Senders | null): SentChunk[];
