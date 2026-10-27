import type { DriveRoot } from './completion.ts';
export type PolicyPreset = 'read-only' | 'workspace-write' | 'full';
export type NetworkMode = 'off' | 'hosts' | 'on';
export type PolicyRoot = string;
export interface FilesPolicy {
    readonly read?: readonly PolicyRoot[] | 'all';
    readonly write?: readonly PolicyRoot[];
    readonly deny?: readonly PolicyRoot[];
}
export interface NetworkPolicy {
    readonly mode: NetworkMode;
    readonly hosts?: readonly string[];
    readonly localhost?: boolean;
    readonly bind?: boolean;
}
export interface ExecPolicy {
    readonly allow?: readonly string[];
    readonly deny?: readonly string[];
}
export interface PolicyRule {
    readonly decision: 'allow' | 'ask' | 'deny';
    readonly tool?: string;
    readonly command?: readonly string[];
    readonly paths?: readonly string[];
    readonly hosts?: readonly string[];
}
export interface AccessPolicy {
    readonly preset?: PolicyPreset;
    readonly files?: FilesPolicy;
    readonly network?: NetworkPolicy;
    readonly sockets?: readonly PolicyRoot[];
    readonly exec?: ExecPolicy;
    readonly env?: readonly string[];
    readonly rules?: readonly PolicyRule[];
}
export interface CompiledPolicy {
    readonly files: {
        readonly read: readonly PolicyRoot[] | 'all';
        readonly write: readonly PolicyRoot[];
        readonly deny: readonly PolicyRoot[];
    };
    readonly network: {
        readonly mode: NetworkMode;
        readonly hosts: readonly string[];
        readonly localhost: boolean;
        readonly bind: boolean;
    };
    readonly sockets: readonly PolicyRoot[] | 'all';
    readonly exec: {
        readonly allow: readonly string[] | 'all';
        readonly deny: readonly string[];
    };
    readonly env: readonly string[] | 'all';
    readonly rules: readonly PolicyRule[];
}
export interface PolicyGrants {
    readonly read?: readonly PolicyRoot[];
    readonly write?: readonly PolicyRoot[];
    readonly deny?: readonly PolicyRoot[];
}
export interface RunRoots {
    readonly fsRoots?: readonly DriveRoot[] | undefined;
    readonly fsWriteRoots?: readonly DriveRoot[] | undefined;
    readonly deny?: readonly PolicyRoot[];
}
export interface PolicyEnforcement {
    readonly files: 'paths' | 'workspace-only' | 'none';
    readonly network: 'hosts' | 'on-off' | 'none';
    readonly env?: boolean;
    readonly exec?: boolean;
}
export interface PolicyProvider {
    readonly name: string;
    readonly enforces?: PolicyEnforcement;
}
