import type { InstallStep, SkillRequires, SkillSetup } from './manifest.ts';
export interface ParsedManifest {
    requires?: SkillRequires;
    install?: InstallStep[];
    setup?: SkillSetup;
    env?: Readonly<Record<string, string>>;
    stub?: boolean;
    minCapabilityProfile?: string;
    emoji?: string;
}
export declare function parseManifestBlock(block: string, key?: string): ParsedManifest;
export declare function readInstall(v: unknown): InstallStep[] | undefined;
export declare function readSetup(v: unknown): SkillSetup | undefined;
export declare function toWireSetup(setup: SkillSetup | undefined): unknown;
