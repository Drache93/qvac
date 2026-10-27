export type CapabilityProfile = 'tiny' | 'low' | 'mid' | 'high' | 'xhigh';
export type SkillState = 'ready' | 'needs-setup' | 'failed' | 'disabled' | 'disconnected' | 'outdated' | 'incompatible-model' | 'unsupported';
export interface InstallStep {
    readonly id: string;
    readonly kind: string;
    readonly formula?: string | undefined;
    readonly bins?: ReadonlyArray<string> | undefined;
    readonly label: string;
    readonly command?: string | undefined;
    readonly manual?: boolean | undefined;
}
export interface SkillTransport {
    readonly credentialKey: string;
    readonly name: string;
    readonly directive: string;
}
export interface SkillSetupField {
    readonly key: string;
    readonly label: string;
    readonly placeholder?: string | undefined;
    readonly secret?: boolean | undefined;
    readonly required?: boolean | undefined;
}
export interface SkillOAuthConfig {
    readonly stateKey: string;
    readonly authUrl: string;
    readonly tokenUrl: string;
    readonly scopes: ReadonlyArray<string>;
    readonly tokenAuth: 'pkce-only' | 'secret-in-body' | 'secret-in-basic';
    readonly extraAuthParams?: Readonly<Record<string, string>> | undefined;
    readonly registrationEndpoint?: string | undefined;
    readonly port?: number | undefined;
    readonly sharedIosSession?: boolean | undefined;
}
export interface SkillSetupRoute {
    readonly kind: 'oauth' | 'token' | 'install' | 'picker' | 'instructions';
    readonly label: string;
    readonly provider?: string | undefined;
    readonly credentialKey?: string | undefined;
    readonly description?: string | undefined;
    readonly helpUrl?: string | undefined;
    readonly steps?: ReadonlyArray<string> | undefined;
    readonly configSteps?: ReadonlyArray<string> | undefined;
    readonly fields?: ReadonlyArray<SkillSetupField> | undefined;
    readonly satisfied?: boolean | undefined;
    readonly oauth?: SkillOAuthConfig | undefined;
}
export interface SkillSetup {
    readonly summary?: string | undefined;
    readonly routes?: ReadonlyArray<SkillSetupRoute> | undefined;
}
export interface SkillMetadata {
    readonly name: string;
    readonly description: string;
    readonly os?: ReadonlyArray<string> | undefined;
    readonly requires?: {
        readonly bins?: ReadonlyArray<string> | undefined;
        readonly credentials?: ReadonlyArray<string> | undefined;
        readonly binMinVersions?: Readonly<Record<string, {
            readonly min: string;
            readonly command?: string | undefined;
        }>> | undefined;
        readonly credentialChecks?: Readonly<Record<string, {
            readonly url: string;
            readonly method?: string | undefined;
            readonly headers?: Readonly<Record<string, string>> | undefined;
        }>> | undefined;
    } | undefined;
    readonly transports?: ReadonlyArray<SkillTransport> | undefined;
    readonly install?: ReadonlyArray<InstallStep> | undefined;
    readonly surfaceWhenUnsupported?: boolean | undefined;
    readonly setup?: SkillSetup | undefined;
    readonly stub?: boolean | undefined;
    readonly tools?: ReadonlyArray<string> | undefined;
    readonly minCapabilityProfile?: CapabilityProfile | undefined;
}
export interface SkillEntry {
    readonly metadata: SkillMetadata;
    readonly content: string;
    readonly available: boolean;
    readonly state: SkillState;
}
