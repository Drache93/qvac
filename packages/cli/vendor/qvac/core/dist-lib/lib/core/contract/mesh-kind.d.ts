import type { Router } from '../../../spec/mesh/hyperdispatch/index.js';
import type { RouterContext } from './types.ts';
export declare function meshKind(tx: RouterContext['tx']): Promise<string | null>;
export declare function accountKind(tx: RouterContext['tx']): Promise<boolean>;
export declare function sharedKind(tx: RouterContext['tx']): Promise<boolean>;
export declare function registerMeshKindRoutes(router: Router): void;
