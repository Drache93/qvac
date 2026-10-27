export type VoiceLane = <T>(job: () => Promise<T>) => Promise<T>;
export declare function createVoiceLane(): VoiceLane;
