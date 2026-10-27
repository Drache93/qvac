import type { HostProvider, ReleaseManifest } from './types';
export declare function hostModules(requirements: ReleaseManifest['hosts'], providers: Readonly<Record<string, HostProvider>>): Record<string, unknown>;
