interface Rule {
    base: string;
    regex: RegExp;
    negate: boolean;
    dirOnly: boolean;
}
export declare class IgnoreRules {
    #private;
    constructor(rules?: readonly Rule[]);
    add(base: string, text: string): IgnoreRules;
    ignored(relPath: string, isDir: boolean): boolean;
}
export {};
