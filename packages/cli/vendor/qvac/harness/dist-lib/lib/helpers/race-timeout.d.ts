export interface RaceTimeoutOptions<T> {
    ms: number;
    fallback: T;
}
export declare function raceTimeout<T>(pending: Promise<T>, { ms, fallback }: RaceTimeoutOptions<T>): Promise<T>;
