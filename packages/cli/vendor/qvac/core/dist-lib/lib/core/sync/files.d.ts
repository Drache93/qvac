import type HyperDB from 'hyperdb';
import type { ViewChange } from 'hyperdb';
import type { ViewHead } from '../mesh.ts';
export declare class FileChanges {
    private readonly _snap;
    private readonly _from;
    private readonly _documents;
    private readonly _chats;
    private readonly _agents;
    private readonly _devices;
    constructor(snap: HyperDB, from: ViewHead);
    add(change: ViewChange): Promise<void>;
    private _was;
    ids(): Promise<Set<string>>;
}
