import type { Router } from '../../../spec/mesh/hyperdispatch/index.js';
import type HyperDB from 'hyperdb';
import type { QvacDevice } from '../../../spec/mesh/hyperschema/types.d.ts';
export declare function removedBy(tx: HyperDB, device: QvacDevice): Promise<'itself' | 'own-member' | 'another-member'>;
export declare function registerInviteRoutes(router: Router): void;
