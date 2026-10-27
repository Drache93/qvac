import type { AutobeeView } from 'autobee';
import type HyperDB from 'hyperdb';
import type { LoggerInterface } from '@qvac/logging';
export interface BackgroundSyncHost {
    readonly view: HyperDB;
    readonly autobee: {
        readonly bee: AutobeeView;
    };
    readonly closing: Promise<void> | null;
    emit(event: string, ...args: unknown[]): boolean;
}
export interface BackgroundSyncOptions {
    readonly batch: number;
    readonly pauseMs: number;
    readonly logger: LoggerInterface | null;
    readonly scope: ReadonlyArray<string>;
}
export interface BackgroundSynced {
    readonly length: number;
}
export declare class BackgroundSync {
    private readonly _host;
    private readonly _opts;
    private _focus;
    private _running;
    private _again;
    private _stopped;
    private _paused;
    private _unpause;
    private _wake;
    private _entries;
    constructor(host: BackgroundSyncHost, opts: BackgroundSyncOptions);
    focus(chatId: string): void;
    run(focus?: string): Promise<boolean>;
    pause(): void;
    resume(): void;
    stop(): void;
    private _passes;
    private _pass;
    private _walkChats;
    private _next;
    private _walkChat;
    private _walkTree;
    private _step;
    private get _cut();
    private _sleep;
}
