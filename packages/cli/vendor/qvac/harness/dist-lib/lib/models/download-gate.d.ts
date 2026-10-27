import type { AbortSignal as BareAbortSignal } from 'bare-abort-controller';
import type { ModelAddon } from './model-source.ts';
export interface HeldModel {
    readonly model: string;
    readonly addon: ModelAddon;
}
export interface DownloadGateOptions {
    isCached(model: string, addon: ModelAddon): Promise<boolean>;
    onHeld(held: HeldModel): void;
    onDropped(held: HeldModel): void;
}
export type HoldFn = (model: string, addon: ModelAddon, signal?: BareAbortSignal) => Promise<void>;
export interface DownloadGate {
    readonly allowed: boolean;
    setAllowed(allowed: boolean): void;
    downloaded(): void;
    hold: HoldFn;
    abandon(): void;
}
export declare function createDownloadGate({ isCached, onHeld, onDropped }: DownloadGateOptions): DownloadGate;
