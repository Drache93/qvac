import type { Mesh } from '../mesh.ts';
import { type AgentCatalogMigrationContext } from './agent-catalog.ts';
import { type MembershipMigrationContext } from './membership.ts';
export type MigrationContext = MembershipMigrationContext & AgentCatalogMigrationContext;
export interface RunMigrationsOptions {
    readonly catalog?: boolean;
}
export declare function runMigrations(mesh: Mesh, context: MigrationContext, { catalog }?: RunMigrationsOptions): Promise<boolean>;
