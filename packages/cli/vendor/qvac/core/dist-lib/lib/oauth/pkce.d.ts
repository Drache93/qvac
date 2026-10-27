type RandomBytes = (size: number) => Uint8Array;
export interface PkceChallenge {
    readonly verifier: string;
    readonly challenge: string;
    readonly method: 'S256';
}
export declare function generatePkceChallenge(randomBytes?: RandomBytes): PkceChallenge;
export declare function base64url(bytes: Buffer | Uint8Array): string;
export declare function createPkce(randomBytes?: RandomBytes): PkceChallenge;
export {};
