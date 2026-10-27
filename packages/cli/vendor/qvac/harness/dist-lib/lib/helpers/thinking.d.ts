export type TextEvent = {
    type: 'thinking' | 'content';
    text: string;
};
export interface SplitThinkingOptions {
    startInThink?: boolean;
}
export declare function tapThinking(tokens: AsyncIterable<string>, opts: SplitThinkingOptions, onThinking: () => void): AsyncGenerator<string>;
export declare function splitThinking(tokens: AsyncIterable<string>, opts?: SplitThinkingOptions): AsyncGenerator<TextEvent, string | null>;
