import type HyperDB from 'hyperdb';
import type { Router } from '../../../spec/mesh/hyperdispatch/index.js';
export declare const MESH_RULES_ROW = "mesh";
export declare const WORKSPACES_RULES = 1;
export declare const KNOWN_RULES = 1;
export declare function rulesVersion(tx: HyperDB): Promise<number>;
export declare function bornUnderRules(tx: HyperDB): Promise<boolean>;
export declare function registerMeshRulesRoutes(router: Router): void;
