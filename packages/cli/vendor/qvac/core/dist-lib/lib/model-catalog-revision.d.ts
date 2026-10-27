import type { AssistantModelCatalogRevision } from '../spec/hyperschema/types.d.ts';
export declare class ModelCatalogRevisionHub {
    private readonly _listeners;
    private _revision;
    private _closed;
    notify(): void;
    watch(): AsyncIterable<AssistantModelCatalogRevision>;
    close(): void;
}
