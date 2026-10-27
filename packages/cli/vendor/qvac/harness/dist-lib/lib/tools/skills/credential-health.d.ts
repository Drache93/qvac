export declare function markCredentialRejected(key: string, agentId?: string | null, skill?: string | null): void;
export declare function markCredentialValid(key: string, agentId?: string | null, skill?: string | null): void;
export declare function recordCredentialHealth(key: string, status: number, agentId?: string | null): void;
export declare function isCredentialRejected(key: string, agentId?: string | null, skill?: string | null): boolean;
export declare function credentialLastProbedAt(key: string, agentId?: string | null, skill?: string | null): number | undefined;
export interface CredentialScope {
    readonly agentId?: string | null;
    readonly skill?: string | null;
}
export declare function setCredentialLastProbedAt(key: string, at: number, { agentId, skill }?: CredentialScope): void;
export declare function resetCredentialHealth(key: string, agentId?: string | null, skill?: string | null): void;
export declare function resetAllCredentialHealth(): void;
