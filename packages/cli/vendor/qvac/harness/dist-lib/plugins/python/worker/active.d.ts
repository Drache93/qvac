import { type WorkerMessage } from './protocol.ts';
import type { WorkerLink } from './spawn.ts';
export interface ActiveWorker {
    readonly link: WorkerLink;
    readonly view: Uint8Array;
    readonly ready: Promise<void>;
    nextId: number;
}
export declare function activeWorker(boot: () => ActiveWorker): ActiveWorker;
export declare function forget(worker: ActiveWorker): void;
export declare function destroy(worker: ActiveWorker): void;
export declare function readMessage(link: WorkerLink): Promise<WorkerMessage | null>;
export declare function drainAndReap(worker: ActiveWorker): Promise<void>;
export interface Grace {
    expired: Promise<'grace'>;
    clear: () => void;
}
export declare function grace(ms: number): Grace;
export declare function closePythonWorker(): Promise<void>;
