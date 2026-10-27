export declare const SKILL_STATE: {
    readonly ready: 'ready';
    readonly needsSetup: 'needs-setup';
    readonly disconnected: 'disconnected';
    readonly unsupported: 'unsupported';
    readonly disabled: 'disabled';
    readonly outdated: 'outdated';
    readonly incompatibleModel: 'incompatible-model';
    readonly failed: 'failed';
};
export type SkillState = (typeof SKILL_STATE)[keyof typeof SKILL_STATE];
export declare function isAvailableState(state: SkillState): boolean;
export declare function isDeviceSharedCredentialKey(key: string): boolean;
