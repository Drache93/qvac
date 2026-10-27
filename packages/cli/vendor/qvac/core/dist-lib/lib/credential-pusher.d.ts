import type { Harness } from './assistant.ts';
import { type ConfigEngine } from './oauth.ts';
import type { OAuthRouteLike } from './oauth/keys.ts';
export interface CredentialEntry {
    key: string;
    token?: string | null;
    expiresAt?: number | null;
    agentId?: string | null;
    skill?: string | null;
}
export interface SettingEntry {
    skill: string;
    key: string;
    value: string;
    agentId?: string | null;
}
export interface PusherSkill {
    name: string;
    credentials?: readonly string[];
    requires?: {
        credentials?: readonly string[];
    };
    setup?: {
        routes?: ReadonlyArray<OAuthRouteLike & {
            fields?: ReadonlyArray<{
                key: string;
                secret?: boolean;
            }>;
        }>;
    };
}
export interface CredentialEngine extends ConfigEngine {
    configWatch(req: {
        key: string;
    }): AsyncIterable<unknown> & {
        destroy(): void;
    };
    agentsWatch(req: {
        meshId: string;
    }): AsyncIterable<unknown> & {
        destroy(): void;
    };
    account(req: {}): Promise<{
        meshId?: string | null;
    }>;
    listAgents(req: {
        meshId: string;
    }): Promise<{
        agents?: ReadonlyArray<{
            id: string;
        }> | null;
    }>;
}
export interface CredentialTarget {
    setCredentials: NonNullable<Harness['setCredentials']>;
    setSkillSettings?: (entries: ReadonlyArray<SettingEntry>) => void | Promise<void>;
    skills?: (agentId?: string | null, modelName?: string | null, options?: {
        readonly skipCredentialProbe?: boolean;
    }) => Promise<ReadonlyArray<PusherSkill>>;
}
export interface CredentialPusherLogger {
    warn(...args: unknown[]): void;
}
export type CredentialPusherHandle = (() => Promise<void>) & {
    sync(): Promise<void>;
    ready(): Promise<void>;
};
export declare function nextRefreshDelay(entries: ReadonlyArray<Pick<CredentialEntry, 'expiresAt'>>, now?: number): number;
export declare function credentialOwners(catalog: ReadonlyArray<PusherSkill>): ReadonlyMap<string, readonly string[]>;
export declare function settingFields(catalog: ReadonlyArray<PusherSkill>): ReadonlyArray<Pick<SettingEntry, 'skill' | 'key'>>;
export declare function settingConfigKey(agentId: string | undefined, skill: string, key: string): string;
export declare function startCredentialPusher(harness: CredentialTarget, engine: CredentialEngine, logger?: CredentialPusherLogger | null): CredentialPusherHandle;
