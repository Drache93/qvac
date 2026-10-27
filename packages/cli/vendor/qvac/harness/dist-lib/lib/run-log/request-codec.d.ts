import { type CompletionParams } from '../helpers/completion-params.ts';
import type { ModelRequest, RequestRecord } from './protocol-types.ts';
type Tools = NonNullable<CompletionParams['tools']>;
export declare function toolsRef(tools: Tools): string;
export declare function requestRecord({ round, attempt, droppedTurns, params }: ModelRequest): RequestRecord;
export declare class RequestEncoder {
    private previous;
    private readonly written;
    encode(whole: RequestRecord, base: readonly unknown[] | undefined): RequestRecord;
}
export declare class RequestDecoder {
    private previous;
    private readonly blocks;
    decode(record: RequestRecord, base: readonly unknown[] | undefined): CompletionParams;
    private tools;
}
export {};
