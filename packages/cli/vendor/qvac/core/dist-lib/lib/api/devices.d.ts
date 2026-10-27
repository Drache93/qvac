import type { LoggerInterface } from '@qvac/logging';
import type { AssistantCapabilityProfile } from '../../spec/hyperschema/types.d.ts';
import type { Mesh } from '../core/mesh.ts';
import { type MeshPool } from './current-mesh.ts';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
export interface CreateDevicesApiOptions {
    readonly deviceId: Buffer;
    readonly log: LoggerInterface | null;
    readonly removeWriter: (writerKey: Buffer, deviceId: Buffer, mesh: Mesh) => Promise<void>;
    readonly renameLocal: (name: string) => Promise<void>;
    readonly saveProfileLocal: (capabilityProfile: AssistantCapabilityProfile, recommendedModelName: string, platform?: string) => Promise<void>;
    readonly readLocalProfile: () => {
        capabilityProfile: AssistantCapabilityProfile;
        recommendedModelName: string;
        platform?: string;
    } | null;
    readonly isAccount: (mesh: Mesh) => boolean;
}
export declare function createDevicesApi(pool: MeshPool, { deviceId, log, removeWriter, renameLocal, saveProfileLocal, readLocalProfile, isAccount }: CreateDevicesApiOptions): Pick<CapabilityHandlers, 'listDevices' | 'getDevice' | 'devicesWatch' | 'deviceInfo' | 'saveDeviceCapabilities' | 'saveDeviceProfile' | 'removeDevice' | 'renameDevice'>;
