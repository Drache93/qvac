import type { MembershipMigrationContext } from './membership.ts';
import type { Mesh } from '../mesh.ts';
export declare function sealDeviceRows(mesh: Mesh, { deviceKeyPair, deviceName, log }: Pick<MembershipMigrationContext, 'deviceKeyPair' | 'deviceName' | 'log'>): Promise<boolean>;
