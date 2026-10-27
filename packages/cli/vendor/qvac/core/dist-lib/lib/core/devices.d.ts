import type { QvacToolReportEntry } from '../../spec/mesh/hyperschema/types.d.ts';
import type { AppBuildMetadata } from './app-build.ts';
import type { Mesh } from './mesh.ts';
export interface SaveDeviceCapabilitiesInput {
    deviceId: Buffer;
    installedToolNames: string[];
    installedSkillNames: string[];
    installedModelNames: string[];
    cachedModelNames: string[];
    readySkillNames?: string[] | null;
    toolCatalog?: QvacToolReportEntry[] | null;
}
export declare function saveDeviceCapabilities(store: Mesh, input: SaveDeviceCapabilitiesInput, isAccount: (mesh: Mesh) => boolean): Promise<void>;
export declare function retractInventory(store: Mesh, deviceId: Buffer, isAccount: (mesh: Mesh) => boolean): Promise<void>;
export declare function advertiseDeviceVersion(store: Mesh, deviceId: Buffer, app: AppBuildMetadata): Promise<void>;
