import type { Capabilities } from './api/index.ts';
type Unscoped<T> = T extends (input: infer I, ...rest: infer R) => infer O ? I extends {
    meshId: string;
} ? (input: Omit<I, 'meshId'>, ...rest: R) => O : T : T;
export type ScopedCapabilities = {
    readonly [K in keyof Capabilities]: Unscoped<Capabilities[K]>;
};
export declare const MESH_SCOPED: ReadonlySet<keyof Capabilities>;
export declare function meshScoped(engine: Capabilities, meshId: string): ScopedCapabilities;
export {};
