import type { JsonSchema } from './cli-schema-types.ts';
export declare function buildSchemaAnnotation(schema: JsonSchema): (argv: readonly string[]) => 'read' | 'write';
export declare function buildSchemaOutputCap(schema: JsonSchema): (argv: readonly string[]) => number | undefined;
export declare function buildSchemaCheck(schema: JsonSchema, resourcePaths: readonly string[] | undefined): (argv: readonly string[]) => string | null;
