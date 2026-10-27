export type Slot = string | readonly string[];
export interface OpSpec {
    readonly slots: readonly Slot[];
    readonly inches?: boolean;
    readonly query?: boolean;
    readonly aliases?: Readonly<Record<string, string>>;
}
export declare const PPTX_OPS: Readonly<Record<string, OpSpec>>;
export declare const DOCX_OPS: Readonly<Record<string, OpSpec>>;
export declare const XLSX_OPS: Readonly<Record<string, OpSpec>>;
export declare function opKeys(spec: OpSpec): string[];
export declare function withAliases(spec: OpSpec, op: Readonly<Record<string, unknown>>): Record<string, unknown>;
export declare function opArguments(spec: OpSpec, op: Readonly<Record<string, unknown>>, toEmu: (inches: number) => number): unknown[];
