import AbortController, { AbortSignal } from 'bare-abort-controller';
import type Bundlebee from 'bundlebee';
import type { Store } from 'bundlebee/types';
import type { NetworkOptions } from './options';
export declare class Network {
    readonly store: Store;
    readonly bundle: Bundlebee;
    readonly options: NetworkOptions;
    readonly controller: AbortController;
    private deadline;
    private dht;
    private swarm;
    private connections;
    private done;
    private readonly abort;
    private readonly expire;
    constructor(store: Store, bundle: Bundlebee, options: NetworkOptions);
    get signal(): AbortSignal;
    connectMirrors(): AbortSignal;
    discover(): Promise<void>;
    close(): Promise<void>;
    private start;
    private closeMirrors;
}
