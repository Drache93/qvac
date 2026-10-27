export interface ResponseDecoder {
    decode: (body: Record<string, unknown>) => Record<string, unknown>;
}
export declare const DECODER_NAMES: readonly ['gmail-message'];
export type DecoderName = (typeof DECODER_NAMES)[number];
export declare const DECODERS: Record<DecoderName, ResponseDecoder>;
