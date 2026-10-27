export interface JsonSchema {
    readonly type?: string;
    readonly properties?: Readonly<Record<string, JsonSchema>>;
    readonly required?: readonly string[];
    readonly additionalProperties?: boolean | JsonSchema;
    readonly oneOf?: readonly JsonSchema[];
    readonly anyOf?: readonly JsonSchema[];
    readonly enum?: readonly unknown[];
    readonly pattern?: string;
    readonly description?: string;
    readonly 'x-positionals'?: readonly string[];
    readonly 'x-rest'?: string;
    readonly 'x-resource-files'?: readonly string[];
    readonly 'x-resource-effects'?: Readonly<Record<string, string>>;
    readonly 'x-effect'?: string;
    readonly 'x-max-output-chars'?: number;
    readonly [key: string]: unknown;
}
export interface SkillCli {
    readonly bin: string;
    readonly schema?: JsonSchema;
    readonly schemaFile?: string;
    readonly resourcePaths?: readonly string[];
}
export declare const CLI_SCHEMA_FILENAME = "cli.schema.json";
export interface CliValidator {
    readonly bin: string;
    readonly fingerprint: string;
    readonly check: (argv: readonly string[]) => string | null;
    readonly annotation: (argv: readonly string[]) => 'read' | 'write';
    readonly effect: (argv: readonly string[]) => 'read' | 'write';
    readonly outputCap: (argv: readonly string[]) => number | undefined;
}
