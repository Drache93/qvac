interface RunRequestFields {
    readonly capability?: string | null;
    readonly originDeviceId: Buffer;
    readonly runnerDeviceId?: Buffer | null;
    readonly runTakenBy?: Buffer | null;
}
export interface RunDriverInput {
    readonly request: RunRequestFields;
    readonly agent: {
        readonly providerDeviceId: Buffer;
    };
}
export declare function runDriver({ request, agent }: RunDriverInput): Buffer | null;
export declare function drivenBy(input: RunDriverInput, deviceId: Buffer): boolean;
export declare function offeredTo(request: RunRequestFields, deviceId: Buffer): boolean;
export declare function handedOff(request: RunRequestFields, deviceId: Buffer): boolean;
export {};
