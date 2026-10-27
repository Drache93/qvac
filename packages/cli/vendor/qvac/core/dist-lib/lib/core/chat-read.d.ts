import type HyperDB from 'hyperdb';
import type { QvacChat } from '../../spec/mesh/hyperschema/types.d.ts';
export declare function ownReadThrough(snap: HyperDB, chat: QvacChat, memberId: Buffer | null): Promise<number | undefined>;
export declare function ownReads(snap: HyperDB, chats: ReadonlyArray<QvacChat>, memberId: Buffer | null): Promise<Map<string, number | undefined>>;
