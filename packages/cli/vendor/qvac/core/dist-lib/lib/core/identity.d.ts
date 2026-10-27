import type { KeyPair } from 'hypercore-crypto';
import type IdentityKey from 'keet-identity-key';
export declare const MAX_PROOF_BYTES = 1024;
export interface MintedIdentity {
    readonly publicKey: Buffer;
    readonly proof: Buffer;
}
export interface ExpectedDeviceProof {
    readonly memberId: Buffer;
    readonly deviceId: Buffer;
}
export interface ExpectedMemberClaim {
    readonly memberId: Buffer;
    readonly deviceId: Buffer;
    readonly attestation: Buffer;
}
export declare function generateMnemonic(): Promise<string>;
export declare function openIdentity(mnemonic: string): Promise<IdentityKey>;
export declare function mintIdentity(mnemonic: string, devicePublicKey: Buffer): Promise<MintedIdentity>;
export declare function attestDeviceProof(devicePublicKey: Buffer, parent: KeyPair, parentProof: Buffer): Promise<Buffer>;
export declare function pairingAnchorSeed(accountSeed: Buffer, memberId: Buffer): Buffer;
export declare function chainTo(proof: Buffer, publicKey: Buffer): Buffer | null;
export declare function delegationFits(proof: Buffer, delegate: KeyPair): Promise<boolean>;
export declare function verifyDeviceProof(proof: Buffer, expected: ExpectedDeviceProof): Promise<boolean>;
export declare function claimAttestation(meshPublicKey: Buffer, deviceId: Buffer, writerKey: Buffer): Buffer;
export declare function attestMemberClaim(attestation: Buffer, deviceKeyPair: KeyPair, deviceProof: Buffer): Promise<Buffer>;
export declare function verifyMemberClaim(proof: Buffer, expected: ExpectedMemberClaim): Promise<boolean>;
export declare function verifyRecoveryClaim(proof: Buffer, expected: ExpectedMemberClaim): Promise<boolean>;
export declare function bareDeviceProof(proof: Buffer): Buffer | null;
