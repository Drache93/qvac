export type FieldEncoding = 'base64' | 'base64url';
export declare function encodeDeclaredFields(body: string | Record<string, unknown> | undefined, encode: Record<string, unknown> | undefined): string | Record<string, unknown> | undefined;
