export interface CredentialSlotSource {
    readonly credentials?: readonly string[] | undefined;
    readonly requires?: {
        readonly credentials?: readonly string[] | undefined;
    } | undefined;
}
export declare function credentialSlots(entry: CredentialSlotSource): readonly (readonly string[])[];
