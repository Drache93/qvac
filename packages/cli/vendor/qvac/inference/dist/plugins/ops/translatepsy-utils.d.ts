export declare function isTranslatePsyModel(model: {
    name?: string | undefined;
    path: string;
}): boolean;
export declare const TRANSLATEPSY_GENERATION_PARAMS: {
    temp: number;
    top_k: number;
    top_p: number;
    repeat_penalty: number;
    predict: number;
    seed: number;
    reasoning_budget: number;
};
export declare function buildTranslatePsyMessages(from: string, to: string, text: string): {
    role: string;
    content: string;
}[];
