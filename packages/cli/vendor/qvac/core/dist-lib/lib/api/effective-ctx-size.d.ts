import type { QvacAgent } from '../../spec/mesh/hyperschema/types.d.ts';
import { type ModelContextOptions } from '../model-context.ts';
export interface EffectiveCtxSizeOptions extends ModelContextOptions {
    readonly appCtxSize: number;
    readonly platform: string | null;
}
export declare function effectiveCtxSize(agent: Pick<QvacAgent, 'ctxSize' | 'modelName'> | null, opts: EffectiveCtxSizeOptions): number;
