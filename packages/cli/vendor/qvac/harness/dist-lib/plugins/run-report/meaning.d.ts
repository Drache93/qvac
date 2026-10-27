export type Tone = 'trouble' | 'person' | 'limit' | 'end' | 'error';
export interface Meaning {
    says: string;
    tone?: Tone;
}
export declare const MEANINGS: Record<string, Meaning>;
