import b4a from 'b4a';
class Utf8Decoder {
    decode(input) {
        if (input === undefined)
            return '';
        const view = input instanceof ArrayBuffer
            ? new Uint8Array(input)
            : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
        return b4a.toString(view, 'utf8');
    }
}
export function ensureTextDecoder() {
    const g = globalThis;
    g.TextDecoder ??= Utf8Decoder;
}
