import type Corestore from 'corestore';
import type { Hypercore } from 'corestore';
import type { KeyPair } from 'hypercore-crypto';
import type IdentityKey from 'keet-identity-key';
export interface RecoveryKeys {
    readonly coreKeyPair: KeyPair;
    readonly encryptionKey: Buffer;
}
export interface RecoveryRecord {
    readonly meshKey: Buffer;
    readonly seed: Buffer;
    readonly createdAt: number;
}
export declare function recoveryKeys(identity: IdentityKey): RecoveryKeys;
export declare function openRecoveryCore(store: Corestore, keys: RecoveryKeys): Hypercore;
export declare function publishRecovery(core: Hypercore, next: RecoveryRecord): Promise<boolean>;
export interface ReadRecoveryOptions {
    readonly timeout?: number;
}
export declare function readRecovery(core: Hypercore, { timeout }?: ReadRecoveryOptions): Promise<RecoveryRecord | null>;
