import type { JsonSchema } from './cli-schema-types.ts';
export interface CommandWalk {
    node: JsonSchema;
    pathSegs: string[];
    index: number;
}
export declare function walkCommands(argv: readonly string[], schema: JsonSchema): CommandWalk;
export declare function argvToObject(argv: readonly string[], schema: JsonSchema): Record<string, unknown> | string;
export declare function objectProps(schema: JsonSchema): Readonly<Record<string, JsonSchema>>;
export declare function isObjectSchema(schema: JsonSchema): boolean;
