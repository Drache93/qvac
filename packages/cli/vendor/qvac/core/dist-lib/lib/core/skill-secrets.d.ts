import type { AssistantPushSkillSecretRequest } from '../../spec/hyperschema/types.d.ts';
import type { openLocalStore } from './local/index.ts';
import type { Mesh } from './mesh.ts';
export type SkillSecretRequest = AssistantPushSkillSecretRequest;
export type SetupFields = (skillName: string) => Promise<ReadonlyMap<string, boolean> | null>;
export interface SkillSecretsOptions {
    readonly local: ReturnType<typeof openLocalStore>;
    readonly setupFields: SetupFields;
    readonly onstored: () => Promise<unknown>;
}
export declare function storeSkillSecret(opts: SkillSecretsOptions, request: SkillSecretRequest): Promise<void>;
export declare function isDeviceKey(key: string): boolean;
type LocalStore = ReturnType<typeof openLocalStore>;
export interface SkillSecretSync {
    readonly account: Mesh;
    readonly local: LocalStore;
}
export declare function syncSkillSecrets(sync: SkillSecretSync): Promise<boolean>;
export {};
