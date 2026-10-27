export interface ResolvedPlace {
    readonly area: string;
    readonly region: string;
    readonly country: string;
}
export declare function fold(value: string): string;
export declare function describePlace(place: ResolvedPlace): string;
export declare function qualifierOf(location: string): string | null;
export declare function cityMatches(location: string, place: ResolvedPlace): boolean;
export type QualifierVerdict = 'match' | 'unverifiable' | 'contradiction';
export declare function checkQualifier(qualifier: string, place: ResolvedPlace): QualifierVerdict;
