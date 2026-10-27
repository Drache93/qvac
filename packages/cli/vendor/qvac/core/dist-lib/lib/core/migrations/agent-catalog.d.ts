import { type HealthAssistantHost } from '../health-assistant.ts';
import type { Mesh } from '../mesh.ts';
export interface AgentCatalogMigrationContext {
    readonly device: HealthAssistantHost;
}
export declare function migrateAgentCatalog(mesh: Mesh, { device }: AgentCatalogMigrationContext): Promise<boolean>;
