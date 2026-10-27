import type HyperDB from 'hyperdb';
import type { Router } from '../../../spec/mesh/hyperdispatch/index.js';
export declare function dropMemberAgents(tx: HyperDB, memberId: Buffer): Promise<void>;
export declare function dropMemberCopies(tx: HyperDB, deviceIds: Buffer[], at: number): Promise<void>;
export declare function dropUser(tx: HyperDB, userId: Buffer): Promise<void>;
export declare function dropMemberAgentUses(tx: HyperDB, memberId: Buffer, userId: Buffer): Promise<void>;
export declare function registerAgentRoutes(router: Router): void;
