export type ShellConstructKind = 'chain' | 'ampersand' | 'pipe' | 'redirect-output' | 'redirect-input' | 'newline' | 'expansion' | 'backtick' | 'continuation' | 'process-substitution' | 'subshell' | 'group' | 'negation' | 'keyword' | 'function' | 'eval' | 'comment' | 'unterminated';
export interface ShellConstruct {
    readonly kind: ShellConstructKind;
    readonly at: number;
}
export interface ShellRedirect {
    readonly fd: string;
    readonly op: string;
    readonly target: string;
}
export interface ShellCommand {
    readonly argv: string[];
    readonly expands: boolean[];
    readonly assignments: string[];
    readonly redirects: ShellRedirect[];
}
export declare class ShellLine {
    #private;
    readonly commands: ShellCommand[];
    readonly ops: string[];
    readonly constructs: ShellConstruct[];
    readonly unjudgeable: string | null;
    constructor(line: string);
    static parse(line: string): ShellLine;
    static escape(value: string): string;
}
