import type { AccessPolicy, CompiledPolicy, PolicyGrants, PolicyProvider, PolicyRoot, RunRoots } from '../contract/policy.ts';
export declare class Policy {
    static narrow(...layers: readonly (AccessPolicy | null | undefined)[]): AccessPolicy;
    static compile(policy: AccessPolicy | null | undefined, grants?: PolicyGrants): CompiledPolicy;
    static enforceable(policy: CompiledPolicy, { enforces }: PolicyProvider): string | null;
    static refusal(policy: CompiledPolicy, providers: readonly PolicyProvider[]): string | null;
    static forRun(layers: readonly (AccessPolicy | null | undefined)[], { fsRoots, fsWriteRoots, deny }: RunRoots, providers: readonly PolicyProvider[]): CompiledPolicy | undefined;
    static withWrites(policy: CompiledPolicy, roots: readonly PolicyRoot[]): CompiledPolicy;
    static hostsOf(policy: CompiledPolicy | undefined): readonly string[] | undefined;
    static allowsHost(hosts: readonly string[], host: string): boolean;
}
