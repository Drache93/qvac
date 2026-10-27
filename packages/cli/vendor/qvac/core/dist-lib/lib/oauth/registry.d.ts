import { type OAuthKeySpec, type OAuthRouteLike } from './keys.ts';
interface SkillLike {
    readonly origin?: string;
    readonly setup?: {
        readonly routes?: ReadonlyArray<OAuthRouteLike> | null | undefined;
    } | null;
}
export declare function oauthSpecs(skills: ReadonlyArray<SkillLike>): ReadonlyArray<OAuthKeySpec>;
export declare function oauthSpecFor(skills: ReadonlyArray<SkillLike>, credentialKey: string): OAuthKeySpec | null;
export {};
