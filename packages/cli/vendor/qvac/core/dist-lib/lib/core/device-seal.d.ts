import type { KeyPair } from 'hypercore-crypto';
export declare const SEALED_SEED_BYTES: number;
export declare function sealToDevice(message: Buffer, deviceId: Buffer): Buffer;
export declare function openSealedToDevice(sealed: Buffer, deviceKeyPair: KeyPair): Buffer | null;
