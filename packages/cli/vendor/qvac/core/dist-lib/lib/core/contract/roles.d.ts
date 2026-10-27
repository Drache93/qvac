import type { Router } from '../../../spec/mesh/hyperdispatch/index.js';
export type MeshRole = 'account' | 'public' | 'workspace' | 'project';
export interface RoleOptions {
    readonly role?: MeshRole;
}
export declare const ROUTE_ROLES: Readonly<Record<string, readonly MeshRole[]>>;
export declare function inRole(role: MeshRole, route: string): boolean;
export declare function publicRoute(name: string): boolean;
export declare function assertRoleRoute(role: MeshRole, name: string): void;
export declare function roleDrops(router: Router, role: MeshRole): Router;
