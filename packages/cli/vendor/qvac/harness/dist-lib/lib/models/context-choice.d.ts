import type { CapabilityProfile } from './model-catalog-constants.ts';
export interface ContextAsk {
    trained(): Promise<number | undefined>;
    fits(ctxSize: number): Promise<boolean>;
}
export declare class ContextChoice {
    private readonly _profile;
    private readonly _pending;
    private readonly _chosen;
    constructor(profile: () => Promise<CapabilityProfile | undefined>);
    static ceiling(profile: CapabilityProfile | undefined): number | undefined;
    chosen(key: string): number | undefined;
    choose(key: string, tier: number, ask: ContextAsk): Promise<number>;
    private _climb;
}
