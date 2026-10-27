export interface OverlayWatcher {
    stop(): void;
}
export type OverlayChangeStream = AsyncIterable<{
    diff?: readonly unknown[];
}> & {
    destroy?: () => void;
};
export type WatchStreamFactory = (overlayDir: string) => OverlayChangeStream;
export interface WatchSkillsOverlayOptions {
    debounceMs?: number;
    createStream?: WatchStreamFactory;
}
export declare function watchSkillsOverlay(overlayDir: string, onChange: () => void, opts?: WatchSkillsOverlayOptions): OverlayWatcher;
