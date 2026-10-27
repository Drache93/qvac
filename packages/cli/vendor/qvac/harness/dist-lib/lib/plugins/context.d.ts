import type { Scope, Dispose } from './scope.ts';
export interface Services {
}
export type ServiceName = keyof Services & string;
export interface Context extends Readonly<Services> {
}
export declare class Context {
    private readonly _root;
    private readonly _scope;
    private readonly _values;
    constructor(scope: Scope);
    get<K extends ServiceName>(name: K): Services[K];
    provide<K extends ServiceName>(name: K, value: Services[K]): void;
    onDispose(dispose: Dispose): void;
}
export declare function createContext(scope: Scope, root?: Context): Context;
