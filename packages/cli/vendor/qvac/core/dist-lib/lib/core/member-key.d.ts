export interface BoxKeyPair {
    readonly publicKey: Buffer;
    readonly secretKey: Buffer;
}
export declare function memberBoxKeyPair(accountSeed: Buffer): BoxKeyPair;
export declare function sealToMember(message: Buffer, boxKey: Buffer): Buffer;
export declare function openSealedToMember(sealed: Buffer, keyPair: BoxKeyPair): Buffer | null;
