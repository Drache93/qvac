import type { LoggerInterface } from '@qvac/logging';
import type { QvacMeshName } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from '../core/mesh.ts';
import { type MeshPool } from './current-mesh.ts';
import type { MeshStatusSource } from './mesh.ts';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
type Named = Pick<QvacMeshName, 'name' | 'namedAt'>;
type AccountOf = () => Mesh | null;
export type NameOf = (projectKey: Buffer) => Named | null;
export declare function projectName(name: string | null | undefined): string;
export type ProjectOf = (workspaceKey: Buffer, projectKey: Buffer) => Promise<boolean>;
interface ProjectsOptions {
    readonly account: AccountOf;
    readonly projectOf: ProjectOf;
    readonly nameOf: NameOf;
    readonly log: LoggerInterface | null;
}
type Changes = Pick<MeshStatusSource, 'watch' | 'unwatch'>;
export declare function createProjectsApi(pool: MeshPool, source: Pick<MeshStatusSource, 'createProject'> & Changes, options: ProjectsOptions): Pick<CapabilityHandlers, 'createProject' | 'listProjects' | 'projectsWatch' | 'updateProject' | 'addProjectMember' | 'removeProjectMember' | 'setProjectOrder' | 'deleteProject'>;
export {};
