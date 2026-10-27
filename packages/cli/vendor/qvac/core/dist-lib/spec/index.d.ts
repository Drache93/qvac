// Hand-written surface for the generated hyperdb definition modules.
type HyperDBDefinition = {
  readonly versions: { readonly schema: number; readonly db: number };
  readonly collections: ReadonlyArray<unknown>;
  readonly indexes: ReadonlyArray<unknown>;
  resolveCollection(name: string): unknown | null;
  resolveIndex(name: string): unknown | null;
};

export declare const QvacMeshSpec: HyperDBDefinition;
export declare const LocalSpec: HyperDBDefinition;

// hypersdispatch codec for the @qvac namespace — typed surface for the generated
// (untyped) encode/decode. Used to encode autobee oplog ops
export declare function encode<T = unknown>(name: string, value: T): Buffer;

interface Schema {
  encode<T = unknown>(name: string, value: T): Buffer;
  decode<T = unknown>(name: string, buffer: Buffer): T;
  getEnum<T = unknown>(name: string): T;
}

export declare const mesh: Schema;
export declare const local: Schema;

export class Router<Context = unknown> {
  add<Payload>(path: string, handler: (payload: Payload, context: Context) => void): void;
  dispatch(value: Buffer, context: Context): Promise<void>;
}

// Generated doc interfaces + string-literal enum unions (hyperschema-ts). The
// single source of truth for migrated doc shapes — services import these
// instead of hand-declaring types.
export type * from "./mesh/hyperschema/types";
export type * from "./local/hyperschema/types";
export type * from "./hyperschema/types";
