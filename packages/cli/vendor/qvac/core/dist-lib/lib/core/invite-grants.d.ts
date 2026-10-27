import type { KeyPair } from 'hypercore-crypto';
export declare const GRANT_MAX_TTL_MS: number;
export declare const GRANT_MAX_USES = 100;
export declare const INVITE_GRANT_NO_EXPIRY = "An invite must expire";
export declare const INVITE_GRANT_TOO_LONG = "An invite cannot expire more than 30 days after it is made";
export declare const INVITE_GRANT_USES_OUT_OF_RANGE = "An invite admits between 1 and 100 people";
export interface InviteGrantTerms {
    readonly expiresAt?: number;
    readonly maxUses?: number;
}
export interface InviteClaimBinding {
    readonly meshPublicKey: Buffer;
    readonly grantKey: Buffer;
    readonly deviceId: Buffer;
    readonly writerKey: Buffer;
}
export declare function grantKeyPair(secret: Buffer): KeyPair;
export declare function inviteGrantTermsRefusal(terms: InviteGrantTerms, mintedAt: number): string | null;
export declare function signInviteClaim(secretKey: Buffer, binding: InviteClaimBinding): Buffer;
export declare function verifyInviteClaim(signature: Buffer | null | undefined, binding: InviteClaimBinding): boolean;
