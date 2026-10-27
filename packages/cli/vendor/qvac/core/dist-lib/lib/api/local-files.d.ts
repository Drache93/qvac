import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import type { LocalFiles } from '../core/local/files.ts';
export interface MeshAlias {
    keyOf(meshId: string): Buffer;
    idOf(meshKey: Buffer): string;
}
export declare function createLocalFilesApi(files: LocalFiles, alias?: MeshAlias): Pick<CapabilityHandlers, 'listLocalFiles'>;
