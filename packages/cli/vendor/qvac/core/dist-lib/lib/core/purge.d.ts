import type Corestore from 'corestore';
import type CorestoreStorage from 'hypercore-storage';
export declare function purgeCores(store: Corestore, storage: CorestoreStorage, discoveryKeys: ReadonlyArray<Buffer>): Promise<void>;
