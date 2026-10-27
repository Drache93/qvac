export type TextType = 'content' | 'thinking';
export interface TextCoalescerOptions {
    cap?: number;
    holdMs?: number;
}
export declare class TextCoalescer {
    private readonly _write;
    private readonly _cap;
    private readonly _holdMs;
    private _buffered;
    private _hold;
    constructor(write: (type: TextType, text: string) => Promise<void>, { cap, holdMs }?: TextCoalescerOptions);
    add(type: TextType, text: string): Promise<void>;
    flush(): Promise<void>;
}
