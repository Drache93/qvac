import type { SkillCli } from './cli-schema.ts';
export type { SkillCli };
export interface SkillRequires {
    readonly bins?: readonly string[];
    readonly binMinVersions?: Readonly<Record<string, {
        readonly min: string;
        readonly command?: string;
    }>>;
    readonly credentials?: readonly string[];
    readonly credentialChecks?: Readonly<Record<string, {
        readonly url: string;
        readonly method?: string;
        readonly headers?: Readonly<Record<string, string>>;
    }>>;
}
export interface InstallStep {
    readonly id: string;
    readonly kind: string;
    readonly label: string;
    readonly formula?: string;
    readonly bins?: readonly string[];
    readonly command?: string;
    readonly manual?: boolean;
}
export interface SkillSetupField {
    readonly key: string;
    readonly label: string;
    readonly placeholder?: string;
    readonly secret?: boolean;
    readonly required?: boolean;
}
export interface SkillOAuthConfig {
    readonly stateKey: string;
    readonly authUrl: string;
    readonly tokenUrl: string;
    readonly scopes: readonly string[];
    readonly tokenAuth: 'pkce-only' | 'secret-in-body' | 'secret-in-basic';
    readonly extraAuthParams?: Readonly<Record<string, string>>;
    readonly registrationEndpoint?: string;
    readonly port?: number;
    readonly sharedIosSession?: boolean;
    readonly verify?: SkillOAuthVerify;
}
export interface SkillOAuthVerify {
    readonly url: string;
    readonly method?: 'GET' | 'POST';
    readonly body?: string;
    readonly reject: readonly SkillOAuthVerifyRule[];
}
export interface SkillOAuthVerifyRule {
    readonly error: string;
    readonly status?: readonly number[];
    readonly field?: string;
    readonly notEqual?: string;
}
export interface SkillSetupRoute {
    readonly kind: 'oauth' | 'token' | 'install' | 'picker' | 'instructions';
    readonly label: string;
    readonly provider?: string;
    readonly credentialKey?: string;
    readonly description?: string;
    readonly helpUrl?: string;
    readonly steps?: readonly string[];
    readonly configSteps?: readonly string[];
    readonly fields?: readonly SkillSetupField[];
    readonly satisfied?: boolean;
    readonly oauth?: SkillOAuthConfig;
}
export interface SkillSetup {
    readonly summary?: string;
    readonly routes?: readonly SkillSetupRoute[];
}
