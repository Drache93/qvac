export declare const STOP_MARKERS: readonly string[];
export declare const RUNAWAY_STOP_SEQUENCES: readonly string[];
export declare function endsTurn(token: string): boolean;
export declare function controlTokenIndex(text: string): number;
export declare function truncateAtControlToken(text: string): string;
export declare function stripControlTokens(text: string): string;
export declare function stopAtControlToken(tokens: AsyncIterable<string>, onStop?: (token: string) => void): AsyncGenerator<string>;
