export interface WriterClaimBinding {
    readonly meshPublicKey: Buffer;
    readonly deviceId: Buffer;
    readonly writerKey: Buffer;
    readonly joinedAt: number;
}
export interface DeviceAttestation {
    readonly deviceId: Buffer;
    readonly signature: Buffer;
}
export declare function signDeviceAttestation(secretKey: Buffer, deviceId: Buffer): DeviceAttestation;
export declare function verifyDeviceAttestation(publicKey: Buffer, attestation: DeviceAttestation): boolean;
export declare function signWriterClaim(secretKey: Buffer, binding: WriterClaimBinding): Buffer;
export declare function verifyWriterClaim(signature: Buffer | null | undefined, binding: WriterClaimBinding): boolean;
export interface MemberWriterClaimBinding extends WriterClaimBinding {
    readonly memberId: Buffer;
}
export declare function signMemberWriterClaim(secretKey: Buffer, binding: MemberWriterClaimBinding): Buffer;
export declare function verifyMemberWriterClaim(signature: Buffer | null | undefined, binding: MemberWriterClaimBinding): boolean;
